import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  CH,
  type RecorderCommand,
  type RecorderErrorPayload,
  type RecorderStoppedPayload
} from '../shared/channels'

const recorderApi = {
  onCommand(cb: (cmd: RecorderCommand) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, cmd: RecorderCommand): void => cb(cmd)
    ipcRenderer.on(CH.recorderCommand, listener)
    return () => ipcRenderer.removeListener(CH.recorderCommand, listener)
  },
  sendStarted(): void {
    ipcRenderer.send(CH.recorderStarted)
  },
  sendStopped(payload: RecorderStoppedPayload): void {
    ipcRenderer.send(CH.recorderStopped, payload)
  },
  sendError(payload: RecorderErrorPayload): void {
    ipcRenderer.send(CH.recorderError, payload)
  }
}

const settingsApi = {
  get: (): Promise<unknown> => ipcRenderer.invoke(CH.settingsGet),
  set: (patch: Record<string, unknown>): Promise<unknown> => ipcRenderer.invoke(CH.settingsSet, patch),
  testProvider: (): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke(CH.providerTest),
  onDictationResult(cb: (result: unknown) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, result: unknown): void => cb(result)
    ipcRenderer.on(CH.dictationResult, listener)
    return () => ipcRenderer.removeListener(CH.dictationResult, listener)
  },
  onDictationError(cb: (err: { message: string }) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, err: { message: string }): void => cb(err)
    ipcRenderer.on(CH.dictationError, listener)
    return () => ipcRenderer.removeListener(CH.dictationError, listener)
  },
  openAccessibilitySettings(): void {
    void shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
  }
}

const api = { recorder: recorderApi, settings: settingsApi }

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
