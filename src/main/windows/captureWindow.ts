import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/**
 * Hidden, never-focusable recording window.
 * The three webPreferences switches below are load-bearing for background
 * recording: without backgroundThrottling:false the media pipeline gets
 * throttled by macOS/App Nap in a hidden window.
 */
export function createCaptureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  // Never steal focus from the app the user is dictating into.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/capture.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/capture.html'))
  }

  return win
}
