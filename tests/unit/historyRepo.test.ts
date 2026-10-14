import { describe, it, expect } from 'vitest'

// better-sqlite3 is rebuilt for the Electron ABI by postinstall; in a plain
// node vitest run the module may not load — skip gracefully when it can't.
let Database: typeof import('better-sqlite3').default
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3')
} catch {
  Database = null as never
}

const maybe = Database ? describe : describe.skip

maybe('historyRepo', () => {
  const { createHistoryRepo } = require('../../src/main/db/historyRepo')
  const { openDbForTest } = require('../../src/main/db/test-helper')

  it('inserts, lists, searches, deletes, clears', () => {
    const repo = createHistoryRepo(openDbForTest())
    repo.insert({ status: 'ok', refined_text: '明天开会', provider_id: 'relay', duration_ms: 3200 })
    repo.insert({ status: 'error', error_msg: 'err.network', duration_ms: 1000 })
    repo.insert({ status: 'ok', refined_text: 'meeting tomorrow', provider_id: 'gemini' })

    let rows = repo.list({})
    expect(rows.length).toBe(3)
    expect(rows[0].refined_text).toBe('meeting tomorrow') // newest first

    rows = repo.list({ q: '开会' })
    expect(rows.length).toBe(1)

    repo.remove(rows[0].id)
    expect(repo.list({}).length).toBe(2)

    repo.clear()
    expect(repo.list({}).length).toBe(0)
  })
})
