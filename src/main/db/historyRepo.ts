import type { HistoryDb } from './index'

export interface HistoryRow {
  id: number
  created_at: string
  mode: string
  status: string
  error_msg: string | null
  refined_text: string | null
  raw_transcript: string | null
  detected_language: string | null
  duration_ms: number | null
  provider_id: string | null
  models_used: string | null
  focused_app_name: string | null
  bundle_id: string | null
  window_title: string | null
  audio_context: string | null
}

export interface NewHistoryEntry {
  status: 'ok' | 'error'
  error_msg?: string
  refined_text?: string
  raw_transcript?: string
  detected_language?: string
  duration_ms?: number
  provider_id?: string
  models_used?: string[]
  focused_app_name?: string
  bundle_id?: string
  window_title?: string
  audio_context?: { selectedText?: string; focusedText?: string }
}

export function createHistoryRepo(db: HistoryDb) {
  const insertStmt = db.prepare(`
    INSERT INTO history
      (status, error_msg, refined_text, raw_transcript, detected_language,
       duration_ms, provider_id, models_used, focused_app_name, bundle_id,
       window_title, audio_context)
    VALUES
      (@status, @error_msg, @refined_text, @raw_transcript, @detected_language,
       @duration_ms, @provider_id, @models_used, @focused_app_name, @bundle_id,
       @window_title, @audio_context)
  `)
  const listStmt = db.prepare(
    'SELECT * FROM history ORDER BY id DESC LIMIT ? OFFSET ?'
  )
  const searchStmt = db.prepare(
    `SELECT * FROM history
     WHERE refined_text LIKE ? OR raw_transcript LIKE ?
     ORDER BY id DESC LIMIT ? OFFSET ?`
  )
  const deleteStmt = db.prepare('DELETE FROM history WHERE id = ?')
  const clearStmt = db.prepare('DELETE FROM history')

  return {
    insert(entry: NewHistoryEntry): number {
      const info = insertStmt.run({
        status: entry.status,
        error_msg: entry.error_msg ?? null,
        refined_text: entry.refined_text ?? null,
        raw_transcript: entry.raw_transcript ?? null,
        detected_language: entry.detected_language ?? null,
        duration_ms: entry.duration_ms ?? null,
        provider_id: entry.provider_id ?? null,
        models_used: entry.models_used ? JSON.stringify(entry.models_used) : null,
        focused_app_name: entry.focused_app_name ?? null,
        bundle_id: entry.bundle_id ?? null,
        window_title: entry.window_title ?? null,
        audio_context: entry.audio_context ? JSON.stringify(entry.audio_context) : null
      })
      return Number(info.lastInsertRowid)
    },
    list(opts: { limit?: number; offset?: number; q?: string }): HistoryRow[] {
      const limit = Math.min(opts.limit ?? 50, 200)
      const offset = Math.max(opts.offset ?? 0, 0)
      if (opts.q && opts.q.trim()) {
        const like = `%${opts.q.trim()}%`
        return searchStmt.all(like, like, limit, offset) as HistoryRow[]
      }
      return listStmt.all(limit, offset) as HistoryRow[]
    },
    remove(id: number): void {
      deleteStmt.run(id)
    },
    clear(): void {
      clearStmt.run()
    }
  }
}

export type HistoryRepo = ReturnType<typeof createHistoryRepo>
