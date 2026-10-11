import { GoogleGenerativeAI } from '@google/generative-ai'
import * as or from './openRouterService.js'
import * as zen from './openCodeZenService.js'
import * as custom from './customProviderService.js'
import { buildAssistantSystem } from './assistantPrompt.js'
import { isCoolingDown, markFailed, markOk } from './providerHealth.js'

const getGenAI = () => {
  const key = process.env.GEMINI_API_KEY
  return key ? new GoogleGenerativeAI(key) : null
}

const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']


const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /forget\s+(all\s+)?(previous\s+)?instructions/i,
  /disregard/i,
  /show\s+(your\s+)?(hidden\s+)?prompt/i,
  /reveal\s+(your\s+)?prompt/i,
  /act\s+as\s+(an?\s+)?(different\s+)?AI/i,
  /you\s+are\s+now/i,
  /new\s+instruction/i,
  /system\s+prompt/i,
  /print\s+(your\s+)?(instructions|prompt)/i,
  /output\s+(your\s+)?(instructions|prompt)/i,
  /tell\s+me\s+(your\s+)?prompt/i,
]

export function detectInjection(message) {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message))
}

export class QuotaError extends Error {
  constructor(retryAfter) {
    super('AI service quota exceeded')
    this.retryAfter = retryAfter
    this.name = 'QuotaError'
  }
}

function getModelConfig() {
  return {
    generationConfig: {
      temperature: 0.5,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  }
}

function buildChat(model, context, systemOverride, history = []) {
  const prompt = systemOverride || buildAssistantSystem(context)
  return model.startChat({
    history: [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: 'Understood. I am ready to assist users with AFAQ Club information.' }] },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ],
  })
}

export async function* generateResponseStream(userMessage, context, systemOverride, history = []) {
  let lastError = null

  // 0) Custom OpenAI-compatible provider (primary)
  let customYielded = false
  try {
    for await (const chunk of custom.generateCustomStream(userMessage, context, systemOverride, history)) {
      customYielded = true
      yield chunk
    }
    if (customYielded) return
  } catch (error) {
    console.error('Custom provider error:', error.message)
    // Already streamed partial output: stop rather than duplicate from a fallback.
    if (customYielded) return
    lastError = error
  }

  // 1) OpenCode Zen (fallback, free models)
  try {
    let yielded = false
    for await (const chunk of zen.generateZenStream(userMessage, context, systemOverride, history)) {
      yielded = true
      yield chunk
    }
    if (yielded) return
  } catch (error) {
    lastError = error
  }

  // 2) Gemini fallback
  const genAI = getGenAI()
  if (genAI) {
    for (const modelName of MODELS) {
      const health = `gemini:${modelName}`
      if (isCoolingDown(health)) continue
      try {
        const model = genAI.getGenerativeModel({ model: modelName, ...getModelConfig() })
        const chat = buildChat(model, context, systemOverride, history)
        const result = await chat.sendMessageStream(userMessage)

        let yielded = false
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            yielded = true
            yield text
          }
        }
        if (yielded) {
          markOk(health)
          return
        }
      } catch (error) {
        markFailed(health, error)
        lastError = error
      }
    }
  }

  // 3) OpenRouter fallback
  try {
    let orYielded = false
    for await (const chunk of or.generateORStream(userMessage, context, systemOverride, history)) {
      orYielded = true
      yield chunk
    }
    if (orYielded) return
  } catch (error) {
    lastError = error
  }

  throw lastError || new Error('All AI models failed')
}

export async function generateResponse(userMessage, context, systemOverride, history = []) {
  let lastError = null
  let allQuota = true
  let lastRetryAfter = 60

  // 0) Custom OpenAI-compatible provider (primary)
  try {
    const customResult = await custom.generateCustomResponse(userMessage, context, systemOverride, history)
    if (customResult) return customResult
  } catch (error) {
    console.error('Custom provider error:', error.message)
    lastError = error
  }

  // 1) OpenCode Zen (fallback, free models)
  try {
    const zenResult = await zen.generateZenResponse(userMessage, context, systemOverride, history)
    if (zenResult) return zenResult
  } catch (error) {
    lastError = error
  }

  // 2) Gemini fallback
  const genAI = getGenAI()
  if (genAI) {
    for (const modelName of MODELS) {
      const health = `gemini:${modelName}`
      if (isCoolingDown(health)) continue
      try {
        const model = genAI.getGenerativeModel({ model: modelName, ...getModelConfig() })
        const chat = buildChat(model, context, systemOverride, history)
        const result = await chat.sendMessage(userMessage)
        markOk(health)
        return result.response.text()
      } catch (error) {
        markFailed(health, error)
        lastError = error
        const isQuota = error.message?.includes('429') || error.message?.includes('quota')
        const retryMatch = error.message?.match(/retry in (\d+\.?\d*)s/)
        if (!isQuota) allQuota = false
        if (retryMatch) lastRetryAfter = parseFloat(retryMatch[1])
      }
    }
  }

  // 3) OpenRouter fallback
  try {
    const orResult = await or.generateORResponse(userMessage, context, systemOverride, history)
    if (orResult) return orResult
  } catch (error) {
    lastError = error
  }

  if (allQuota && lastError) {
    throw new QuotaError(lastRetryAfter)
  }
  throw lastError || new Error('All AI models failed')
}
