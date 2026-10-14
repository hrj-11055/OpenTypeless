import type { AudioPart } from '../../shared/channels'

export interface DictationContext {
  appName?: string
  bundleId?: string
  windowTitle?: string
  selectedText?: string // already truncated
  focusedText?: string // already truncated
  localeHint: 'zh' | 'en' | 'auto'
}

export interface SttResult {
  rawTranscript: string
  detectedLanguage?: string
}

export interface RefineResult {
  refinedText: string
  detectedLanguage?: string
}

/**
 * Fine-grained extension points (v0.2: local whisper.cpp / Ollama implement
 * these without touching the orchestrator).
 */
export interface SttProvider {
  id: string
  transcribe(audio: AudioPart, cfg: ProviderConfig, signal?: AbortSignal): Promise<SttResult>
}

export interface RefineProvider {
  id: string
  refine(
    stt: SttResult,
    ctx: DictationContext,
    cfg: ProviderConfig,
    signal?: AbortSignal
  ): Promise<RefineResult>
}

/** The facade the orchestrator talks to. */
export interface DictationProvider {
  id: string
  label: string
  stages: 1 | 2
  /** Returns an error-message i18n key, or null when configured. */
  validateConfig(cfg: ProviderConfig): string | null
  run(req: DictationRequest, cfg: ProviderConfig, signal?: AbortSignal): Promise<DictationResult>
}

export interface DictationRequest {
  audio: { webm: AudioPart; wav?: AudioPart }
  context: DictationContext
  mode: 'refine' // 'translate' | 'ask' reserved for v0.2
}

export interface DictationResult {
  refinedText: string
  rawTranscript?: string
  detectedLanguage?: string
  providerId: string
  modelsUsed: string[]
}

export interface ProviderConfig {
  apiKey?: string
  model?: string
  sttModel?: string
  refineModel?: string
  baseUrl?: string
}

export class ProviderError extends Error {
  constructor(
    /** i18n key or raw message shown to the user */
    public readonly userMessage: string,
    public readonly cause?: unknown
  ) {
    super(userMessage)
  }
}
