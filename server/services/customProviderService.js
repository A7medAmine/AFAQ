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

// Some upstreams behind the router answer 200 with their own error text as the
// reply (e.g. "This version of Antigravity is no longer supported"). Treat that
// as a failure so the next model is tried instead of showing it to users.
const UPSTREAM_ERROR_REPLY = /no longer supported|please (download|upgrade|update) .{0,40}latest version|re-authenticate your/i
// Arabic UTF-8 decoded as Windows-1252 ("Ø§Ù„..."): some upstreams garble
// non-Latin text, and some letters are lost for good, so it can't be repaired.
const MOJIBAKE = /[ØÙ][\u0080-¿Œ-™�]/g
const SNIFF_CHARS = 160

function assertRealReply(model, text) {
  const head = text.slice(0, 300)
  if (UPSTREAM_ERROR_REPLY.test(head)) {
    throw new Error(`Custom ${model} returned an upstream error as content: ${text.slice(0, 120)}`)
  }
  if ((head.match(MOJIBAKE) || []).length >= 3) {
    throw Object.assign(new Error(`Custom ${model} returned garbled (mis-encoded) text`), { garbled: true })
  }
}

export async function* generateCustomStream(userMessage, context, system, history = []) {
  const cfg = getConfig()
  if (!isConfigured(cfg)) return

  let lastError = null
  for (const model of cfg.models) {
    const health = `custom:${model}`
    if (isCoolingDown(health)) continue

    let yielded = false
    // Hold back the start of the answer until it can be checked for an
    // upstream error masquerading as a reply.
    let head = ''
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
            if (!text) continue
            if (yielded) {
              yield text
            } else {
              head += text
              if (head.length >= SNIFF_CHARS) {
                assertRealReply(model, head)
                yielded = true
                yield head
              }
            }
          } catch (error) {
            if (error instanceof SyntaxError) continue // skip malformed chunk
            throw error
          }
        }
      }
      if (!yielded && head) {
        assertRealReply(model, head)
        yielded = true
        yield head
      }
      if (yielded) {
        markOk(health)
        return
      }
    } catch (error) {
      // Already streamed partial output: stop rather than duplicate from another model.
      if (yielded) throw error
      if (!error.garbled) markFailed(health, error) // garbling depends on the text, not provider health
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
        assertRealReply(model, text)
        markOk(health)
        return text
      }
    } catch (error) {
      if (!error.garbled) markFailed(health, error) // garbling depends on the text, not provider health
      console.error(`Custom ${model} error:`, error.message)
      lastError = error
    }
  }
  if (lastError) throw lastError
  return null
}
