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

interface Api {
  recorder: RecorderApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}

export {}
