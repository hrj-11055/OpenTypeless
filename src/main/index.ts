import { app, shell, session, ipcMain, powerMonitor } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSettingsWindow } from './windows/settingsWindow'
import { createCaptureWindow } from './windows/captureWindow'
import {
  registerDictationShortcut,
  unregisterShortcut,
  DEFAULT_SHORTCUT,
  type ShortcutHandle
} from './shortcuts'
import { Orchestrator } from './orchestrator'
import { createTray, type TrayHandle } from './tray'
import { registerSettingsIpc } from './ipc'
import { CH, type RecorderStoppedPayload } from '../shared/channels'

// Keep dev-run data (settings/db/TCC grants) separate from the packaged app's.
if (is.dev) {
  app.setPath('userData', app.getPath('userData') + '-dev')
}

// Single instance: a second launch just focuses the existing settings window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let settingsWindow: Electron.BrowserWindow | null = null
let orchestrator: Orchestrator | null = null
let shortcutHandle: ShortcutHandle | null = null
let trayHandle: TrayHandle | null = null

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
  } else {
    settingsWindow = createSettingsWindow()
    settingsWindow.on('closed', () => {
      if (orchestrator) orchestrator.setResultListener(null)
      settingsWindow = null
    })
    orchestrator?.setResultListener(settingsWindow)
  }
}

function wireRecorderIpc(orch: Orchestrator): void {
  ipcMain.on(CH.recorderStarted, () => orch.onStarted())
  ipcMain.on(CH.recorderStopped, (_e, payload: RecorderStoppedPayload) => orch.onStopped(payload))
  ipcMain.on(CH.recorderError, (_e, err: { code: string; message?: string }) => orch.onError(err))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hrj11055.opentypeless')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Only the hidden capture page may request microphone permission — a hidden
  // window can never show a permission prompt, so grant it programmatically.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    const isCapturePage = wc.getURL().includes('capture.html')
    callback(permission === 'media' && isCapturePage)
  })

  const captureWindow = createCaptureWindow()
  orchestrator = new Orchestrator(captureWindow)
  wireRecorderIpc(orchestrator)
  registerSettingsIpc()

  shortcutHandle = registerDictationShortcut(DEFAULT_SHORTCUT, () => orchestrator?.toggle())

  // Re-register after sleep/wake: macOS occasionally drops hotkey registrations.
  powerMonitor.on('resume', () => {
    if (shortcutHandle) unregisterShortcut(shortcutHandle)
    shortcutHandle = registerDictationShortcut(DEFAULT_SHORTCUT, () => orchestrator?.toggle())
  })

  orchestrator.setStateListener(() => trayHandle?.refresh())
  trayHandle = createTray(openSettings, () => orchestrator?.getState() ?? 'idle')

  app.on('second-instance', () => openSettings())

  app.on('activate', () => {
    if (settingsWindow === null || settingsWindow.isDestroyed()) openSettings()
  })

  openSettings()
})

app.on('will-quit', () => {
  if (shortcutHandle) unregisterShortcut(shortcutHandle)
})

// Tray app: keep running when windows close (macOS convention).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Open external links in the default browser instead of in-app windows.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http')) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
})
