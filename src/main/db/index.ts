// Local history database (better-sqlite3, synchronous by design).
// v0.1 keeps a single hand-written schema; a migration tool can come later.
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

export type HistoryDb = Database.Database

let db: HistoryDb | null = null

export function openDb(): HistoryDb {
  if (db) return db
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = new Database(join(dir, 'history.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      mode TEXT NOT NULL DEFAULT 'refine',
      status TEXT NOT NULL DEFAULT 'ok',
      error_msg TEXT,
      refined_text TEXT,
      raw_transcript TEXT,
      detected_language TEXT,
      duration_ms INTEGER,
      provider_id TEXT,
      models_used TEXT,
      focused_app_name TEXT,
      bundle_id TEXT,
      window_title TEXT,
      audio_context TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);
  `)
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
