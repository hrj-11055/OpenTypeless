import { globalShortcut, Notification } from 'electron'

export const DEFAULT_SHORTCUT = 'Control+Command+V'

export interface ShortcutHandle {
  accelerator: string
}

/**
 * Register the dictation toggle shortcut. Shows a notification and returns
 * null when the accelerator is already taken by another app.
 */
export function registerDictationShortcut(
  accelerator: string,
  onToggle: () => void
): ShortcutHandle | null {
  globalShortcut.unregister(accelerator)
  const ok = globalShortcut.register(accelerator, onToggle)
  console.log(`[shortcut] register ${accelerator} -> ${ok ? 'ok' : 'FAILED (taken by another app)'}`)
  if (!ok) {
    new Notification({
      title: 'OpenTypeless',
      body: `快捷键 ${accelerator} 注册失败，可能已被其他应用占用`
    }).show()
    return null
  }
  return { accelerator }
}

export function unregisterShortcut(handle: ShortcutHandle): void {
  try {
    globalShortcut.unregister(handle.accelerator)
  } catch {
    // already gone
  }
}
