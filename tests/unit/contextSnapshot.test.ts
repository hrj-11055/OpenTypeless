import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ Notification: class { show(){} } }))
vi.mock('koffi', () => ({ default: { load: vi.fn(() => { throw new Error('no koffi in tests') }) } }))
vi.mock('../../src/main/native/ax', () => ({ readFocusedContext: vi.fn(() => ({})) }))
vi.mock('../../src/main/native/frontApp', () => ({ getFrontApp: vi.fn(async () => ({})) }))

import { buildContext, LIMITS } from '../../src/main/contextSnapshot'

describe('buildContext', () => {
  it('passes through short values untouched', () => {
    const ctx = buildContext({
      appName: '备忘录',
      bundleId: 'com.apple.Notes',
      windowTitle: '购物清单',
      selectedText: '买牛奶',
      focusedText: '清单：牛奶、鸡蛋',
      localeHint: 'zh'
    })
    expect(ctx).toEqual({
      localeHint: 'zh',
      appName: '备忘录',
      bundleId: 'com.apple.Notes',
      windowTitle: '购物清单',
      selectedText: '买牛奶',
      focusedText: '清单：牛奶、鸡蛋'
    })
  })

  it('truncates each field to its limit with an ellipsis', () => {
    const ctx = buildContext({
      selectedText: 'a'.repeat(LIMITS.selectedText + 10),
      focusedText: 'b'.repeat(LIMITS.focusedText + 10),
      windowTitle: 'c'.repeat(LIMITS.windowTitle + 10)
    })
    expect(ctx.selectedText!.length).toBe(LIMITS.selectedText + 1)
    expect(ctx.focusedText!.length).toBe(LIMITS.focusedText + 1)
    expect(ctx.windowTitle!.length).toBe(LIMITS.windowTitle + 1)
    expect(ctx.selectedText!.endsWith('…')).toBe(true)
  })

  it('drops empty/absent fields entirely', () => {
    const ctx = buildContext({ appName: '', selectedText: undefined })
    expect(ctx.appName).toBeUndefined()
    expect(ctx.selectedText).toBeUndefined()
    expect(ctx.localeHint).toBe('auto')
  })
})
