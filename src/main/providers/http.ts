// Shared fetch wrapper: timeout + error classification with user-readable keys.
import { ProviderError } from './types'

export const REQUEST_TIMEOUT_MS = 60_000

export async function fetchJson(
  url: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout
  let resp: Response
  try {
    resp = await fetch(url, {
      ...init,
      signal: composite,
      headers: { 'user-agent': 'OpenTypeless/0.1', ...(init.headers as Record<string, string>) }
    })
  } catch (err) {
    if (signal?.aborted) throw new ProviderError('err.aborted', err)
    throw new ProviderError('err.network', err)
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError('err.apiKeyRejected', `HTTP ${resp.status}`)
  }
  if (resp.status === 429) {
    throw new ProviderError('err.rateLimited', 'HTTP 429')
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new ProviderError(`err.http.${resp.status}`, `${resp.status} ${body.slice(0, 300)}`)
  }
  try {
    return await resp.json()
  } catch (err) {
    throw new ProviderError('err.badResponse', err)
  }
}
