import type { DictationProvider, ProviderConfig } from './types'
import { geminiProvider } from './gemini'
import { openaiProvider } from './openai'
import { relayProvider } from './relay'
import { getApiKey } from '../settings/store'
import { loadSettings } from '../settings/store'

const PROVIDERS: Record<string, DictationProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  relay: relayProvider
}

export function listProviders(): { id: string; label: string; stages: number }[] {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, stages: p.stages }))
}

/** Instantiate the configured provider with its runtime config (key injected). */
export function getActiveProvider(): { provider: DictationProvider; cfg: ProviderConfig } | null {
  const s = loadSettings()
  const provider = PROVIDERS[s.providerId]
  if (!provider) return null
  const stored = s.providerConfig[s.providerId] ?? {}
  const cfg: ProviderConfig = { ...stored, apiKey: getApiKey(s.providerId) ?? undefined }
  return { provider, cfg }
}
