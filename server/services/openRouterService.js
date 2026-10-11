import { buildAssistantSystem } from './assistantPrompt.js'
import { isCoolingDown, markFailed, markOk, fetchWithTimeout } from './providerHealth.js'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const OR_MODELS = [
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-v4-flash:free',
]

function buildMessages(userMessage, context, systemOverride, history = []) {
  return [
    {
      role: 'system',
      content: systemOverride || buildAssistantSystem(context),
    },
    ...history,
    { role: 'user', content: userMessage },
  ]
}

export async function* generateORStream(userMessage, context, systemOverride, history = []) {
  if (!OPENROUTER_API_KEY) return

  for (const model of OR_MODELS) {
    const health = `or:${model}`
    if (isCoolingDown(health)) continue
    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://afaq.club',
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(userMessage, context, systemOverride, history),
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
        }),
      }, 15_000)

      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`OpenRouter ${model} ${res.status}: ${err.slice(0, 200)}`)
      }

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
            const parsed = JSON.parse(payload)
            const text = parsed.choices?.[0]?.delta?.content
            if (text) yield text
          } catch { /* skip */ }
        }
      }
      markOk(health)
      return
    } catch (error) {
      console.error(`OpenRouter ${model} error:`, error.message)
      markFailed(health, error)
    }
  }
}

export async function generateORResponse(userMessage, context, systemOverride, history = []) {
  if (!OPENROUTER_API_KEY) return null

  for (const model of OR_MODELS) {
    const health = `or:${model}`
    if (isCoolingDown(health)) continue
    try {
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://afaq.club',
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(userMessage, context, systemOverride, history),
          temperature: 0.7,
          max_tokens: 4096,
          stream: false,
        }),
      }, 60_000)

      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`OpenRouter ${model} ${res.status}: ${err.slice(0, 200)}`)
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (text) {
        markOk(health)
        return text
      }
    } catch (error) {
      console.error(`OpenRouter ${model} error:`, error.message)
      markFailed(health, error)
    }
  }
  return null
}
