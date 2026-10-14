import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  defaultSettings,
  mergeSettings,
  type AppSettings,
  type ProviderSettings
} from './merge'

const ENV_KEYS: Record<string, Record<string, string>> = {
  gemini: { apiKey: 'OPEN_TYPELESS_GEMINI_API_KEY' },
  openai: { apiKey: 'OPEN_TYPELESS_API_KEY' },
  relay: { apiKey: 'OPEN_TYPELESS_RELAY_KEY' }
}

let cached: AppSettings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  if (cached) return cached
  const file = settingsFile()
  cached = existsSync(file)
    ? mergeSettings(JSON.parse(readFileSync(file, 'utf-8')))
    : defaultSettings()
  return cached
}

export function saveSettings(next: AppSettings): void {
  cached = next
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf-8')
}

/** Encrypt and store a provider API key. Throws when encryption is unavailable. */
export function setApiKey(providerId: string, plaintext: string): void {
  if (!plaintext) throw new Error('empty key')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Keychain encryption unavailable on this machine')
  }
  const s = loadSettings()
  const enc = safeStorage.encryptString(plaintext).toString('base64')
  s.providerConfig[providerId] = { ...s.providerConfig[providerId], apiKeyEnc: enc }
  saveSettings(s)
}

/** Decrypt the stored key; env var override wins (dev convenience). */
export function getApiKey(providerId: string): string | null {
  const envName = ENV_KEYS[providerId]?.apiKey
  if (envName && process.env[envName]) return process.env[envName]
  const conf: ProviderSettings | undefined = loadSettings().providerConfig[providerId]
  const enc = conf?.apiKeyEnc
  if (!enc) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    // Keychain changed (e.g. after macOS restore); treat as missing.
    return null
  }
}

export function hasApiKey(providerId: string): boolean {
  return getApiKey(providerId) !== null
}

/** True when an env override or stored ciphertext exists (for UI hints). */
export function apiKeyConfigured(providerId: string): boolean {
  const envName = ENV_KEYS[providerId]?.apiKey
  if (envName && process.env[envName]) return true
  return Boolean(loadSettings().providerConfig[providerId]?.apiKeyEnc)
}
