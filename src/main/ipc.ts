import { ipcMain } from 'electron'
import { CH } from '../shared/channels'
import {
  loadSettings,
  saveSettings,
  setApiKey,
  apiKeyConfigured,
  hasApiKey
} from './settings/store'
import { getActiveProvider, listProviders } from './providers/registry'
import { ProviderError } from './providers/types'
import { initNative } from './native'
import type { AppSettings } from './settings/merge'

export interface SanitizedSettings {
  locale: AppSettings['locale']
  shortcut: string
  providerId: AppSettings['providerId']
  maxDurationSec: number
  providerConfig: Record<string, Record<string, unknown>>
  providers: { id: string; label: string; stages: number }[]
  axTrusted: boolean
}

/** Settings view for the renderer: models/urls pass through, keys never do. */
export function sanitizedSettings(): SanitizedSettings {
  const s = loadSettings()
  const pc: SanitizedSettings['providerConfig'] = {}
  for (const [id, conf] of Object.entries(s.providerConfig)) {
    const { apiKeyEnc: _dropped, ...rest } = conf as Record<string, string | undefined>
    void _dropped
    pc[id] = {
      ...rest,
      keyConfigured: apiKeyConfigured(id),
      keyWorking: hasApiKey(id)
    }
  }
  return {
    locale: s.locale,
    shortcut: s.shortcut,
    providerId: s.providerId,
    maxDurationSec: s.maxDurationSec,
    providerConfig: pc,
    providers: listProviders(),
    axTrusted: initNative().axTrusted
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(CH.settingsGet, () => sanitizedSettings())

  // Renderer sends a full settings patch; apiKey (if non-empty) is a fresh
  // plaintext key that main encrypts immediately. Empty apiKey = keep stored.
  ipcMain.handle(CH.settingsSet, (_e, patch: Partial<AppSettings> & { apiKey?: string }) => {
    const current = loadSettings()
    const next: AppSettings = {
      ...current,
      ...patch,
      version: 1,
      providerConfig: {
        ...current.providerConfig,
        ...(patch.providerConfig ?? {})
      }
    }
    const apiKey = patch.apiKey
    delete (patch as Record<string, unknown>).apiKey
    if (apiKey) setApiKey(next.providerId, apiKey)
    saveSettings(next)
    return sanitizedSettings()
  })

  ipcMain.handle(CH.providerTest, async () => {
    const active = getActiveProvider()
    if (!active) return { ok: false, message: 'settings.err.noProvider' }
    const invalid = active.provider.validateConfig(active.cfg)
    if (invalid) return { ok: false, message: invalid }
    try {
      // Minimal real request: a silent 0.1s WAV exercises auth + model routing.
      const silentWav = tinySilentWav()
      await active.provider.run(
        {
          audio: {
            webm: { data: new Uint8Array(silentWav), mimeType: 'audio/wav' },
            wav: { data: new Uint8Array(silentWav), mimeType: 'audio/wav' }
          },
          context: { localeHint: 'auto' },
          mode: 'refine'
        },
        active.cfg,
        AbortSignal.timeout(20_000)
      )
      return { ok: true }
    } catch (err) {
      const msg = err instanceof ProviderError ? err.userMessage : 'err.network'
      return { ok: false, message: msg }
    }
  })
}

/** Proper minimal WAV: 44-byte header + 1600 samples (0.1s @16kHz) of silence. */
function tinySilentWav(): ArrayBuffer {
  const samples = 1600
  const dataSize = samples * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  return buf
}
