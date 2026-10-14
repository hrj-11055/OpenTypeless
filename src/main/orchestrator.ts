import { BrowserWindow, Notification, clipboard, powerSaveBlocker } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { homedir } from 'os'
import { app } from 'electron'
import { CH, type RecorderStoppedPayload } from '../shared/channels'
import { getActiveProvider } from './providers/registry'
import { ProviderError, type DictationContext, type DictationResult } from './providers/types'
import { captureSnapshot } from './contextSnapshot'
import { injectText } from './native/pasteInject'
import { initNative } from './native'
import type { HistoryRepo } from './db/historyRepo'

export type DictationState = 'idle' | 'starting' | 'recording' | 'processing' | 'refining'

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
  private lastRefined: DictationResult | null = null
  /** Settings window (or any listener) receiving refined results. */
  private resultListener: BrowserWindow | null = null
  /** Context captured at dictation start (before recording changes focus). */
  private snapshotPromise: Promise<DictationContext> | null = null
  private history: HistoryRepo | null = null

  setHistoryRepo(repo: HistoryRepo): void {
    this.history = repo
  }

  constructor(private captureWin: BrowserWindow) {}

  getState(): DictationState {
    return this.state
  }

  getLastResult(): RecorderStoppedPayload | null {
    return this.lastResult
  }

  getLastRefined(): DictationResult | null {
    return this.lastRefined
  }

  setResultListener(win: BrowserWindow | null): void {
    this.resultListener = win
  }

  setStateListener(cb: (s: DictationState) => void): void {
    this.onStateChange = cb
    cb(this.state)
  }

  toggle(): void {
    console.log(`[dictation] toggle pressed, state=${this.state}`)
    if (this.state === 'idle') void this.start()
    else if (this.state === 'recording') void this.stop()
    // starting/processing: ignore rapid double-presses
  }

  private setState(s: DictationState): void {
    this.state = s
    console.log(`[dictation] state -> ${s}`)
    this.onStateChange?.(s)
  }

  private async start(): Promise<void> {
    this.setState('starting')
    // Snapshot the context NOW: selection/focus exist before we do anything.
    this.snapshotPromise = captureSnapshot()
    this.psbId = powerSaveBlocker.start('prevent-app-suspension')
    this.captureWin.webContents.send(CH.recorderCommand, {
      action: 'start',
      maxDurationSec: MAX_DURATION_SEC,
      preferWav: getActiveProvider()?.provider.id === 'gemini'
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
    console.log('[dictation] capture window confirmed start')
    if (this.state === 'starting') this.setState('recording')
  }

  /** Wire this to ipcMain on CH.recorderStopped. */
  onStopped(payload: RecorderStoppedPayload): void {
    console.log(
      `[dictation] audio received: webm=${payload.webm.data.byteLength}B wav=${payload.wav?.data.byteLength ?? 0}B ${payload.durationMs}ms`
    )
    if (this.state !== 'processing' && this.state !== 'recording') return
    this.cleanup()
    this.lastResult = payload
    this.dumpDevArtifact(payload)
    void this.refine(payload)
  }

  private async refine(payload: RecorderStoppedPayload): Promise<void> {
    this.setState('refining')
    const active = getActiveProvider()
    if (!active) {
      this.finishRefine()
      new Notification({
        title: 'OpenTypeless',
        body: '尚未配置 AI 服务，请打开设置填写 API Key'
      }).show()
      return
    }
    const invalid = active.provider.validateConfig(active.cfg)
    if (invalid) {
      this.finishRefine()
      new Notification({ title: 'OpenTypeless', body: '配置不完整，请打开设置检查' }).show()
      return
    }
    try {
      const context = await (this.snapshotPromise ?? Promise.resolve<DictationContext>({ localeHint: 'auto' }))
      console.log(`[dictation] context: ${JSON.stringify(context)}`)
      const result = await active.provider.run(
        { audio: payload, context, mode: 'refine' },
        active.cfg,
        AbortSignal.timeout(90_000)
      )
      this.lastRefined = result
      console.log(`[dictation] refined (${result.providerId}/${result.modelsUsed.join('+')}): ${result.refinedText.slice(0, 80)}`)
      if (this.resultListener && !this.resultListener.isDestroyed()) {
        this.resultListener.webContents.send(CH.dictationResult, result)
      }
      // Injection: paste at the cursor. Degrade to clipboard + hint when the
      // native path is unavailable (no AX trust).
      let injected = false
      if (initNative().axTrusted) injected = await injectText(result.refinedText)
      if (!injected) clipboard.writeText(result.refinedText)
      console.log(`[inject] ${injected ? 'pasted at cursor' : 'clipboard only (no AX trust)'}`)
      this.history?.insert({
        status: 'ok',
        refined_text: result.refinedText,
        raw_transcript: result.rawTranscript,
        detected_language: result.detectedLanguage,
        duration_ms: payload.durationMs,
        provider_id: result.providerId,
        models_used: result.modelsUsed,
        focused_app_name: context.appName,
        bundle_id: context.bundleId,
        window_title: context.windowTitle,
        audio_context: { selectedText: context.selectedText, focusedText: context.focusedText }
      })
      new Notification({
        title: injected ? 'OpenTypeless 已注入' : 'OpenTypeless',
        body: injected
          ? result.refinedText.slice(0, 120)
          : `已复制，请手动 ⌘V：${result.refinedText.slice(0, 100)}`
      }).show()
    } catch (err) {
      const msg =
        err instanceof ProviderError ? err.userMessage : err instanceof Error ? err.message : '未知错误'
      console.error(`[dictation] refine failed: ${msg}`, err instanceof Error ? err.stack : err)
      this.history?.insert({ status: 'error', error_msg: msg, duration_ms: payload.durationMs })
      if (this.resultListener && !this.resultListener.isDestroyed()) {
        this.resultListener.webContents.send(CH.dictationError, { message: msg })
      }
      new Notification({ title: 'OpenTypeless 润色失败', body: msg }).show()
    } finally {
      this.finishRefine()
    }
  }

  private finishRefine(): void {
    if (this.state === 'refining') this.setState('idle')
  }

  /** Wire this to ipcMain on CH.recorderError. */
  onError(err: { code: string; message?: string }): void {
    console.log(`[dictation] recorder error: ${err.code} ${err.message ?? ''}`)
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
    if (app.isPackaged) return
    const file = join(homedir(), 'Desktop', 'opentypeless-test.webm')
    writeFile(file, payload.webm.data).then(
      () => console.log(`[dev] recording dumped: ${file} (${payload.durationMs}ms)`),
      (e) => console.error('[dev] dump failed', e)
    )
  }
}
