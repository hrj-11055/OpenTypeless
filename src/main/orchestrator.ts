import { BrowserWindow, Notification, powerSaveBlocker } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { homedir } from 'os'
import { app } from 'electron'
import { CH, type RecorderStoppedPayload } from '../shared/channels'

export type DictationState = 'idle' | 'starting' | 'recording' | 'processing'

export const MAX_DURATION_SEC = 120
/** Hard cap on waiting for the capture window to finish after a stop command. */
const STOP_TIMEOUT_MS = 5_000

/**
 * Dictation state machine: idle -> recording -> (processing) -> idle.
 * v0.1 (M1): recording only, result is dumped to a dev file.
 * M2+ plugs providers in at the `processing` stage.
 */
export class Orchestrator {
  private state: DictationState = 'idle'
  private psbId: number | null = null
  private onStateChange?: (s: DictationState) => void
  private lastResult: RecorderStoppedPayload | null = null

  constructor(private captureWin: BrowserWindow) {}

  getState(): DictationState {
    return this.state
  }

  getLastResult(): RecorderStoppedPayload | null {
    return this.lastResult
  }

  setStateListener(cb: (s: DictationState) => void): void {
    this.onStateChange = cb
    cb(this.state)
  }

  toggle(): void {
    if (this.state === 'idle') void this.start()
    else if (this.state === 'recording') void this.stop()
    // starting/processing: ignore rapid double-presses
  }

  private setState(s: DictationState): void {
    this.state = s
    this.onStateChange?.(s)
  }

  private async start(): Promise<void> {
    this.setState('starting')
    this.psbId = powerSaveBlocker.start('prevent-app-suspension')
    this.captureWin.webContents.send(CH.recorderCommand, {
      action: 'start',
      maxDurationSec: MAX_DURATION_SEC
    })
    // State flips to 'recording' when the capture window confirms.
    // If it never confirms (broken preload etc.), recover after a timeout.
    setTimeout(() => {
      if (this.state === 'starting') {
        this.cleanup()
        this.setState('idle')
      }
    }, 3_000)
  }

  async stop(): Promise<void> {
    if (this.state !== 'recording') return
    this.setState('processing')
    this.captureWin.webContents.send(CH.recorderCommand, { action: 'stop' })
    // recorderEngine fires CH.recorderStopped up to ~1s later;
    // a safety timeout recovers the state machine if it never arrives.
    setTimeout(() => {
      if (this.state === 'processing') {
        this.cleanup()
        this.setState('idle')
        new Notification({ title: 'OpenTypeless', body: '录音结果未返回，本次听写已取消' }).show()
      }
    }, STOP_TIMEOUT_MS)
  }

  /** Wire this to ipcMain on CH.recorderStarted. */
  onStarted(): void {
    if (this.state === 'starting') this.setState('recording')
  }

  /** Wire this to ipcMain on CH.recorderStopped. */
  onStopped(payload: RecorderStoppedPayload): void {
    if (this.state !== 'processing' && this.state !== 'recording') return
    this.cleanup()
    this.lastResult = payload
    this.setState('idle')
    this.dumpDevArtifact(payload)
  }

  /** Wire this to ipcMain on CH.recorderError. */
  onError(err: { code: string; message?: string }): void {
    this.cleanup()
    this.setState('idle')
    const body =
      err.code === 'mic-denied'
        ? '麦克风权限被拒绝，请在系统设置中允许 OpenTypeless 使用麦克风'
        : err.code === 'no-device'
          ? '未找到可用的麦克风设备'
          : `录音失败：${err.message ?? err.code}`
    new Notification({ title: 'OpenTypeless', body }).show()
  }

  private cleanup(): void {
    if (this.psbId !== null && powerSaveBlocker.isStarted(this.psbId)) {
      powerSaveBlocker.stop(this.psbId)
    }
    this.psbId = null
  }

  /** Dev convenience: dump the captured audio to Desktop for inspection. */
  private dumpDevArtifact(payload: RecorderStoppedPayload): void {
    if (!process.env.NODE_ENV || app.isPackaged) return
    const ext = payload.mimeType.includes('wav') ? 'wav' : 'webm'
    const file = join(homedir(), 'Desktop', `opentypeless-test.${ext}`)
    writeFile(file, payload.data).then(
      () => console.log(`[dev] recording dumped: ${file} (${payload.durationMs}ms)`),
      (e) => console.error('[dev] dump failed', e)
    )
  }
}
