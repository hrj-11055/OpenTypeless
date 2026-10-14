import { describe, it, expect } from 'vitest'
import { defaultSettings, mergeSettings, applySettingsPatch } from '../../src/main/settings/merge'

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
    expect(s.providerConfig.gemini.model).toBe('gemini-flash-latest')
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

describe('applySettingsPatch', () => {
  const base = mergeSettings({
    providerId: 'relay',
    providerConfig: { relay: { apiKeyEnc: 'enc-abc', model: 'm1', baseUrl: 'https://x/v1' } }
  })

  it('keeps stored apiKeyEnc when the patch omits it (renderer never holds it)', () => {
    const next = applySettingsPatch(base, {
      providerId: 'relay',
      // Exactly what the renderer sends: sanitized view fields only.
      providerConfig: { relay: { model: 'm2', baseUrl: 'https://x/v1', keyConfigured: true } }
    })
    expect(next.providerConfig.relay.apiKeyEnc).toBe('enc-abc')
    expect(next.providerConfig.relay.model).toBe('m2')
  })

  it('does not persist UI-only fields (keyConfigured/keyWorking)', () => {
    const next = applySettingsPatch(base, {
      providerConfig: { relay: { keyConfigured: true, keyWorking: true } }
    })
    const stored = next.providerConfig.relay as Record<string, unknown>
    expect(stored.keyConfigured).toBeUndefined()
    expect(stored.keyWorking).toBeUndefined()
  })

  it('ignores a renderer-sent apiKeyEnc and keeps the stored one', () => {
    const next = applySettingsPatch(base, {
      providerConfig: { relay: { apiKeyEnc: 'forged' } }
    })
    expect(next.providerConfig.relay.apiKeyEnc).toBe('enc-abc')
  })

  it('merges other providers untouched and coerces scalar fields', () => {
    const next = applySettingsPatch(base, {
      locale: 'en',
      maxDurationSec: 9999,
      shortcut: '',
      providerConfig: { openai: { sttModel: 'whisper-2' } }
    })
    expect(next.locale).toBe('en')
    expect(next.maxDurationSec).toBe(120) // out of range -> keep current
    expect(next.shortcut).toBe('Control+Command+V') // empty -> keep current
    expect(next.providerConfig.relay.apiKeyEnc).toBe('enc-abc')
    expect(next.providerConfig.openai.sttModel).toBe('whisper-2')
    expect(next.providerConfig.gemini.model).toBe('gemini-flash-latest')
  })

  it('allows clearing an optional field with an empty string', () => {
    const next = applySettingsPatch(base, {
      providerConfig: { relay: { baseUrl: '' } }
    })
    expect(next.providerConfig.relay.baseUrl).toBe('')
    expect(next.providerConfig.relay.apiKeyEnc).toBe('enc-abc')
  })
})
