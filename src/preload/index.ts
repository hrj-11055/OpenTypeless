import { contextBridge, ipcRenderer } from 'electron'
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

const api = { recorder: recorderApi }

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
