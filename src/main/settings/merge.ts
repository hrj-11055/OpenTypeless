// Pure settings logic (no electron imports) — unit-testable.

export interface ProviderSettings {
  apiKeyEnc?: string // base64(safeStorage ciphertext); never the raw key
  model?: string
  sttModel?: string
  refineModel?: string
  baseUrl?: string
}

export interface AppSettings {
  version: 1
  locale: 'zh-CN' | 'en'
  shortcut: string
  providerId: 'gemini' | 'openai' | 'relay'
  providerConfig: { gemini: ProviderSettings; openai: ProviderSettings; relay: ProviderSettings }
  maxDurationSec: number
}

export function defaultSettings(): AppSettings {
  return {
    version: 1,
    locale: 'zh-CN',
    shortcut: 'Control+Command+V',
    providerId: 'gemini',
    providerConfig: {
      // Default model IDs verified against live vendor APIs on 2026-10-14:
      // gemini-2.5-flash is 404 for new users; use the rolling alias instead.
      gemini: { model: 'gemini-flash-latest' },
      openai: { sttModel: 'whisper-1', refineModel: 'gpt-4o-mini' },
      relay: { model: '' }
    },
    maxDurationSec: 120
  }
}

/** Deep-merge a persisted (possibly partial/older) file over the defaults. */
export function mergeSettings(persisted: unknown): AppSettings {
  const d = defaultSettings()
  if (!persisted || typeof persisted !== 'object') return d
  const p = persisted as Partial<AppSettings>
  return {
    version: 1,
    locale: p.locale === 'en' ? 'en' : 'zh-CN',
    shortcut: typeof p.shortcut === 'string' && p.shortcut ? p.shortcut : d.shortcut,
    providerId: isValidProviderId(p.providerId) ? p.providerId : 'gemini',
    providerConfig: {
      gemini: { ...d.providerConfig.gemini, ...sanitizeProvider(p.providerConfig?.gemini) },
      openai: { ...d.providerConfig.openai, ...sanitizeProvider(p.providerConfig?.openai) },
      relay: { ...d.providerConfig.relay, ...sanitizeProvider(p.providerConfig?.relay) }
    },
    maxDurationSec:
      typeof p.maxDurationSec === 'number' && p.maxDurationSec >= 10 && p.maxDurationSec <= 300
        ? Math.floor(p.maxDurationSec)
        : d.maxDurationSec
  }
}

function isValidProviderId(id: unknown): id is AppSettings['providerId'] {
  return id === 'gemini' || id === 'openai' || id === 'relay'
}

function sanitizeProvider(raw: unknown): ProviderSettings {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: ProviderSettings = {}
  for (const key of ['apiKeyEnc', 'model', 'sttModel', 'refineModel', 'baseUrl'] as const) {
    if (typeof r[key] === 'string' && (r[key] as string).length > 0) {
      out[key] = r[key] as string
    }
  }
  return out
}
