// One-shot provider for OpenAI-compatible relays (one-api/new-api style) that
// translate `input_audio` parts to native multimodal input (Gemini etc.).
// Verified against a new-api deployment 2026-10-14: webm input_audio works.
import type { DictationProvider, DictationResult, ProviderConfig } from './types'
import { ProviderError } from './types'
import { buildAudioPrompt } from './prompt'
import { fetchJson } from './http'

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
}

export const relayProvider: DictationProvider = {
  id: 'relay',
  label: '自定义中转',
  stages: 1,

  validateConfig(cfg): string | null {
    if (!cfg.apiKey) return 'settings.err.noKey'
    if (!cfg.baseUrl) return 'settings.err.noBaseUrl'
    if (!cfg.model) return 'settings.err.noModel'
    return null
  },

  async run(req, cfg: ProviderConfig, signal): Promise<DictationResult> {
    const base = cfg.baseUrl!.replace(/\/+$/, '')
    const mime = req.audio.webm.mimeType || 'audio/webm'
    const format = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'webm'

    const body = {
      model: cfg.model,
      // Dictation polish never needs deep thinking; trim it where the
      // upstream honors reasoning_effort (free latency, no quality loss here).
      reasoning_effort: 'low',
      messages: [
        {
          role: 'user',
          content: [
            // Prefer the WAV rendition when present: some relays/ upstreams
            // reject webm containers.
            {
              type: 'input_audio',
              input_audio: {
                data: toBase64(req.audio.wav ?? req.audio.webm),
                format: req.audio.wav ? 'wav' : format
              }
            },
            { type: 'text', text: buildAudioPrompt(req.context) }
          ]
        }
      ]
    }

    const json = (await fetchJson(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      signal
    )) as ChatResponse

    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) throw new ProviderError('err.emptyResult', JSON.stringify(json).slice(0, 300))
    return { refinedText: text, providerId: 'relay', modelsUsed: [cfg.model!] }
  }
}

function toBase64(part: { data: Uint8Array }): string {
  return Buffer.from(part.data).toString('base64')
}
