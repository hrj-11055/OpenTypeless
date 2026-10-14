import { describe, it, expect } from 'vitest'
import { defaultSettings, mergeSettings } from '../../src/main/settings/merge'

describe('mergeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
    expect(mergeSettings('nope')).toEqual(defaultSettings())
    expect(mergeSettings({})).toEqual(defaultSettings())
  })

  it('keeps valid persisted values and fills the rest', () => {
    const s = mergeSettings({
      locale: 'en',
      providerId: 'relay',
      shortcut: 'Alt+Space',
      providerConfig: { relay: { baseUrl: 'https://x/v1', model: 'm1' } },
      maxDurationSec: 60
    })
    expect(s.locale).toBe('en')
    expect(s.providerId).toBe('relay')
    expect(s.shortcut).toBe('Alt+Space')
    expect(s.providerConfig.relay.baseUrl).toBe('https://x/v1')
    expect(s.providerConfig.relay.model).toBe('m1')
    expect(s.providerConfig.relay.apiKeyEnc).toBeUndefined()
    expect(s.providerConfig.gemini.model).toBe('gemini-2.5-flash')
    expect(s.maxDurationSec).toBe(60)
  })

  it('sanitizes junk types inside provider config', () => {
    const s = mergeSettings({
      providerConfig: {
        relay: { baseUrl: 42, model: 'ok', apiKeyEnc: '', hack: '<script>' }
      }
    })
    expect(s.providerConfig.relay.baseUrl).toBeUndefined()
    expect(s.providerConfig.relay.model).toBe('ok')
    expect((s.providerConfig.relay as Record<string, unknown>).hack).toBeUndefined()
  })

  it('clamps maxDurationSec into [10, 300]', () => {
    expect(mergeSettings({ maxDurationSec: 5 }).maxDurationSec).toBe(120)
    expect(mergeSettings({ maxDurationSec: 9999 }).maxDurationSec).toBe(120)
    expect(mergeSettings({ maxDurationSec: 300 }).maxDurationSec).toBe(300)
  })

  it('rejects unknown provider ids', () => {
    expect(mergeSettings({ providerId: 'skynet' }).providerId).toBe('gemini')
  })
})
