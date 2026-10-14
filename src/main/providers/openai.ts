// Two-stage provider: audio/transcriptions (WebM supported) -> chat completions.
import type {
  DictationProvider,
  DictationRequest,
  DictationResult,
  ProviderConfig,
  SttResult
} from './types'
import { ProviderError } from './types'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { fetchJson } from './http'

const DEFAULT_BASE = 'https://api.openai.com/v1'

interface TranscriptionResponse {
  text?: string
  language?: string
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
}

async function transcribe(
  req: DictationRequest,
  cfg: ProviderConfig,
  signal?: AbortSignal
): Promise<SttResult> {
  const model = cfg.sttModel || 'whisper-1'
  const base = cfg.baseUrl || DEFAULT_BASE
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(req.audio.webm.data)], { type: 'audio/webm' }), 'audio.webm')
  form.append('model', model)
  form.append('response_format', 'json')

  const json = (await fetchJson(
    `${base}/audio/transcriptions`,
    { method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}` }, body: form },
    signal
  )) as TranscriptionResponse

  if (!json.text?.trim()) throw new ProviderError('err.emptyResult', 'empty transcription')
  return { rawTranscript: json.text.trim(), detectedLanguage: json.language }
}

async function refine(
  stt: SttResult,
  req: DictationRequest,
  cfg: ProviderConfig,
  signal?: AbortSignal
): Promise<string> {
  const model = cfg.refineModel || 'gpt-4o-mini'
  const base = cfg.baseUrl || DEFAULT_BASE
  const json = (await fetchJson(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(stt.rawTranscript, req.context) }
        ],
        temperature: 0.2
      })
    },
    signal
  )) as ChatResponse

  const text = json.choices?.[0]?.message?.content?.trim()
  if (!text) throw new ProviderError('err.emptyResult', 'empty completion')
  return text
}

export const openaiProvider: DictationProvider = {
  id: 'openai',
  label: 'OpenAI',
  stages: 2,

  validateConfig(cfg): string | null {
    if (!cfg.apiKey) return 'settings.err.noKey'
    return null
  },

  async run(req, cfg, signal): Promise<DictationResult> {
    const stt = await transcribe(req, cfg, signal)
    const refined = await refine(stt, req, cfg, signal)
    return {
      refinedText: refined,
      rawTranscript: stt.rawTranscript,
      detectedLanguage: stt.detectedLanguage,
      providerId: 'openai',
      modelsUsed: [cfg.sttModel || 'whisper-1', cfg.refineModel || 'gpt-4o-mini']
    }
  }
}
