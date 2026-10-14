// One-shot provider: audio + prompt in a single generateContent call.
// Gemini's supported audio formats exclude WebM, so this provider always
// requires the WAV rendition produced by the capture window.
import type { DictationProvider, DictationResult, ProviderConfig } from './types'
import { ProviderError } from './types'
import { buildAudioPrompt } from './prompt'
import { fetchJson } from './http'

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com'

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

export const geminiProvider: DictationProvider = {
  id: 'gemini',
  label: 'Gemini',
  stages: 1,

  validateConfig(cfg): string | null {
    if (!cfg.apiKey) return 'settings.err.noKey'
    return null
  },

  async run(req, cfg: ProviderConfig, signal): Promise<DictationResult> {
    const model = cfg.model || 'gemini-2.5-flash'
    const audio = req.audio.wav ?? req.audio.webm
    const mime = req.audio.wav ? 'audio/wav' : 'audio/webm'
    const base = cfg.baseUrl || DEFAULT_BASE

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: base64(audio.data) } },
            { text: buildAudioPrompt(req.context) }
          ]
        }
      ]
    }

    const json = (await fetchJson(
      `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey! },
        body: JSON.stringify(body)
      },
      signal
    )) as GeminiResponse

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
    if (!text) throw new ProviderError('err.emptyResult', JSON.stringify(json).slice(0, 300))
    return {
      refinedText: text,
      providerId: 'gemini',
      modelsUsed: [model]
    }
  }
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
