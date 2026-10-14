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
import { createFnWatcher, initNative } from './native'
import { openDb } from './db'
import { createHistoryRepo } from './db/historyRepo'
import { CH, type RecorderStoppedPayload } from '../shared/channels'

// Keep dev-run data (settings/db/TCC grants) separate from the packaged app's.
if (is.dev) {
  app.setPath('userData', app.getPath('userData') + '-dev')
}

// Single instance: a second launch just focuses the existing settings window.
// All startup wiring MUST live in the else-branch — app.quit() is async, and a
// lock-denied instance that still registers whenReady keeps running (ghost
// Dock icons + double fn-key toggles when stale dev instances survive).
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
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

    const historyRepo = createHistoryRepo(openDb())
    orchestrator.setHistoryRepo(historyRepo)
    registerSettingsIpc(historyRepo, (newShortcut) => {
      if (shortcutHandle) unregisterShortcut(shortcutHandle)
      shortcutHandle = registerDictationShortcut(newShortcut, () => orchestrator?.toggle())
    })

    shortcutHandle = registerDictationShortcut(DEFAULT_SHORTCUT, () => orchestrator?.toggle())

    // Primary trigger: fn/globe key (WeChat-Input-Method style), toggled by
    // polling the combined session key state. Keyboard shortcut stays as backup.
    initNative()
    const fnWatcher = createFnWatcher()
    if (fnWatcher) {
      fnWatcher.start(() => orchestrator?.toggle())
      console.log('[shortcut] fn-key trigger active (keyboard shortcut also armed)')
    } else {
      console.log('[shortcut] fn-key unavailable, keyboard shortcut only')
    }

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
}
