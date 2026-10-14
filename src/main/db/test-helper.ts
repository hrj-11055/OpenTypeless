// Test-only helper: fresh in-memory database with the production schema.
import Database from 'better-sqlite3'

export function openDbForTest(): Database.Database {
  const db = new Database(':memory:')
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
  `)
  return db
}
