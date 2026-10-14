import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  RecorderCommand,
  RecorderErrorPayload,
  RecorderStoppedPayload
} from '../shared/channels'

interface RecorderApi {
  onCommand(cb: (cmd: RecorderCommand) => void): () => void
  sendStarted(): void
  sendStopped(payload: RecorderStoppedPayload): void
  sendError(payload: RecorderErrorPayload): void
}

export interface ProviderInfo {
  id: string
  label: string
  stages: number
}

export interface ProviderConfigView {
  model?: string
  sttModel?: string
  refineModel?: string
  baseUrl?: string
  keyConfigured?: boolean
  keyWorking?: boolean
}

export interface SettingsView {
  locale: 'zh-CN' | 'en'
  shortcut: string
  providerId: string
  maxDurationSec: number
  providerConfig: Record<string, ProviderConfigView>
  providers: ProviderInfo[]
}

export interface DictationResultEvent {
  refinedText: string
  rawTranscript?: string
  detectedLanguage?: string
  providerId: string
  modelsUsed: string[]
}

interface SettingsApi {
  get(): Promise<SettingsView>
  set(patch: Record<string, unknown>): Promise<SettingsView>
  testProvider(): Promise<{ ok: boolean; message?: string }>
  onDictationResult(cb: (result: DictationResultEvent) => void): () => void
  onDictationError(cb: (err: { message: string }) => void): () => void
}

interface Api {
  recorder: RecorderApi
  settings: SettingsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

export {}
