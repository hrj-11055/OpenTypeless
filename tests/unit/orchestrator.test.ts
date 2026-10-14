import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  Notification: class MockNotification {
    constructor(public opts: { title: string; body: string }) {}
    show(): void {}
  },
  powerSaveBlocker: {
    _active: new Set<number>(),
    start: vi.fn(() => {
      return 1
    }),
    isStarted: vi.fn((id: number) => true),
    stop: vi.fn()
  },
  app: { isPackaged: true },
  BrowserWindow: class {},
  ipcMain: { on: vi.fn() },
  session: { defaultSession: { setPermissionRequestHandler: vi.fn() } },
  globalShortcut: { register: vi.fn(), unregister: vi.fn() },
  powerMonitor: { on: vi.fn() },
  shell: { openExternal: vi.fn() },
  Tray: class {},
  Menu: { buildFromTemplate: vi.fn(() => ({})) },
  nativeImage: { createFromPath: vi.fn(() => ({ resize: () => ({ setTemplateImage: () => {} }) })) }
}))

import { Orchestrator } from '../../src/main/orchestrator'
import { CH } from '../../src/shared/channels'

function fakeWin(): { webContents: { send: ReturnType<typeof vi.fn> } } {
  return { webContents: { send: vi.fn() } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Orchestrator state machine', () => {
  it('idle -> starting -> recording -> processing -> idle on happy path', () => {
    const win = fakeWin()
    const orch = new Orchestrator(win as never)
    const states: string[] = []
    orch.setStateListener((s) => states.push(s))

    orch.toggle() // start
    expect(win.webContents.send).toHaveBeenCalledWith(CH.recorderCommand, {
      action: 'start',
      maxDurationSec: 120
    })
    expect(orch.getState()).toBe('starting')

    orch.onStarted()
    expect(orch.getState()).toBe('recording')

    void orch.stop()
    expect(win.webContents.send).toHaveBeenCalledWith(CH.recorderCommand, { action: 'stop' })
    expect(orch.getState()).toBe('processing')

    orch.onStopped({
      data: new Uint8Array(4),
      mimeType: 'audio/webm',
      durationMs: 1000
    })
    expect(orch.getState()).toBe('idle')
    expect(orch.getLastResult()?.durationMs).toBe(1000)
    expect(states).toEqual(['idle', 'starting', 'recording', 'processing', 'idle'])
  })

  it('recovers to idle if the capture window never confirms start', () => {
    vi.useFakeTimers()
    try {
      const win = fakeWin()
      const orch = new Orchestrator(win as never)
      orch.toggle()
      expect(orch.getState()).toBe('starting')
      vi.advanceTimersByTime(3100)
      expect(orch.getState()).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers to idle with notification if stop result never arrives', () => {
    vi.useFakeTimers()
    try {
      const win = fakeWin()
      const orch = new Orchestrator(win as never)
      orch.toggle()
      orch.onStarted()
      void orch.stop()
      vi.advanceTimersByTime(5100)
      expect(orch.getState()).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('error path resets state and keeps toggling usable', () => {
    const win = fakeWin()
    const orch = new Orchestrator(win as never)
    orch.toggle()
    orch.onError({ code: 'mic-denied' })
    expect(orch.getState()).toBe('idle')
    // still usable afterwards
    orch.toggle()
    expect(orch.getState()).toBe('starting')
  })
})
