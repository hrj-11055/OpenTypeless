// IPC channel names shared by main and preload. Keep in sync with preload/index.d.ts.
export const CH = {
  // main -> capture renderer
  recorderCommand: 'recorder:command',
  // capture renderer -> main
  recorderStarted: 'recorder:started',
  recorderStopped: 'recorder:stopped',
  recorderError: 'recorder:error'
} as const

export type RecorderCommand = { action: 'start'; maxDurationSec: number } | { action: 'stop' }

export interface RecorderStoppedPayload {
  data: Uint8Array
  mimeType: string
  durationMs: number
}

export interface RecorderErrorPayload {
  code: 'mic-denied' | 'no-device' | 'recorder-failed'
  message?: string
}
