// Custom OpenAI-compatible provider — primary AI provider.
// Configured via CUSTOM_AI_BASE_URL, CUSTOM_AI_API_KEY and CUSTOM_AI_MODEL.
// CUSTOM_AI_MODEL may list several models separated by commas; they are tried
// in order. CUSTOM_AI_TIMEOUT_MS caps how long to wait for a model to start
// answering (default 15s). Returns nothing when unconfigured or failing, so
// callers fall back upstream.
import { buildAssistantSystem } from './assistantPrompt.js'
import { isCoolingDown, markFailed, markOk, fetchWithTimeout } from './providerHealth.js'

const getConfig = () => ({
  base: (process.env.CUSTOM_AI_BASE_URL || '').replace(/\/+$/, ''),
  key: process.env.CUSTOM_AI_API_KEY,
  models: (process.env.CUSTOM_AI_MODEL || '').split(',').map(m => m.trim()).filter(Boolean),
  timeoutMs: Number(process.env.CUSTOM_AI_TIMEOUT_MS) || 15_000,
})

async function request(cfg, model, userMessage, context, stream, system, history = []) {
  const res = await fetchWithTimeout(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system || buildAssistantSystem(context) },
        ...history,
        { role: 'user', content: userMessage },
      ],
      temperature: system ? 0.7 : 0.4,
      // Chat answers are short; a lower cap stops runaway replies.
      max_tokens: system ? 4096 : 1500,
      stream,
    }),
  }, stream ? cfg.timeoutMs : cfg.timeoutMs * 4) // non-stream waits for the whole answer

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Custom ${model} ${res.status}: ${err.slice(0, 200)}`)
  }
  return res
}

const isConfigured = (cfg) => cfg.base && cfg.key && cfg.models.length

export async function* generateCustomStream(userMessage, context, system, history = []) {
  const cfg = getConfig()
  if (!isConfigured(cfg)) return

  let lastError = null
  for (const model of cfg.models) {
    const health = `custom:${model}`
    if (isCoolingDown(health)) continue

    let yielded = false
    try {
      const res = await request(cfg, model, userMessage, context, true, system, history)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue
          try {
            const text = JSON.parse(payload).choices?.[0]?.delta?.content
            if (text) {
              yielded = true
              yield text
            }
          } catch {
            /* skip malformed */
          }
        }
      }
      if (yielded) {
        markOk(health)
        return
      }
    } catch (error) {
      // Already streamed partial output: stop rather than duplicate from another model.
      if (yielded) throw error
      markFailed(health, error)
      console.error(`Custom ${model} error:`, error.message)
      lastError = error
    }
  }
  if (lastError) throw lastError
}

export async function generateCustomResponse(userMessage, context, system, history = []) {
  const cfg = getConfig()
  if (!isConfigured(cfg)) return null

  let lastError = null
  for (const model of cfg.models) {
    const health = `custom:${model}`
    if (isCoolingDown(health)) continue
    try {
      const res = await request(cfg, model, userMessage, context, false, system, history)
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text) {
        markOk(health)
        return text
      }
    } catch (error) {
      markFailed(health, error)
      console.error(`Custom ${model} error:`, error.message)
      lastError = error
    }
  }
  if (lastError) throw lastError
  return null
}
