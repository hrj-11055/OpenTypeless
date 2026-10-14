// Aggregate AX + frontmost-app info into the DictationContext for providers.
import type { DictationContext } from './providers/types'
import { readFocusedContext } from './native/ax'
import { getFrontApp } from './native/frontApp'
import { initNative } from './native'

export const LIMITS = {
  selectedText: 500,
  focusedText: 2000,
  windowTitle: 200
} as const

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…'
}

/** Pure transform — unit-tested. */
export function buildContext(input: {
  appName?: string
  bundleId?: string
  windowTitle?: string
  selectedText?: string
  focusedText?: string
  role?: string
  localeHint?: 'zh' | 'en' | 'auto'
}): DictationContext {
  const ctx: DictationContext = { localeHint: input.localeHint ?? 'auto' }
  if (input.appName) ctx.appName = truncate(input.appName, 100)
  if (input.bundleId) ctx.bundleId = truncate(input.bundleId, 200)
  if (input.windowTitle) ctx.windowTitle = truncate(input.windowTitle, LIMITS.windowTitle)
  if (input.selectedText) ctx.selectedText = truncate(input.selectedText, LIMITS.selectedText)
  if (input.focusedText) ctx.focusedText = truncate(input.focusedText, LIMITS.focusedText)
  return ctx
}

/**
 * Capture what the user is looking at, right before dictation starts.
 * Every source degrades silently; worst case we return localeHint only.
 */
export async function captureSnapshot(localeHint: 'zh' | 'en' | 'auto' = 'auto'): Promise<DictationContext> {
  const axReady = initNative().axTrusted
  const [front, ax] = await Promise.all([getFrontApp(), Promise.resolve(axReady ? readFocusedContext() : {})])
  // Skip our own windows: dictating into OpenTypeless settings is not the target.
  const isSelf = front.bundleId === 'com.github.electron' || front.appName === 'Electron'
  return buildContext({
    appName: isSelf ? undefined : front.appName,
    bundleId: isSelf ? undefined : front.bundleId,
    windowTitle: ax.windowTitle,
    selectedText: ax.selectedText,
    focusedText: ax.value,
    role: ax.role,
    localeHint
  })
}
