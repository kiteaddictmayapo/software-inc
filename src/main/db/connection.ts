/**
 * Conexión a SQLite (better-sqlite3).
 *
 * No importa Electron a propósito: así el importador y la capa de datos pueden
 * probarse con Node plano (ver test/). El proceso main resuelve la ruta con
 * paths.ts y la pasa aquí.
 */
import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'

let db: DB | null = null

export function openDatabase(filePath: string): DB {
  const instance = new Database(filePath)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  instance.pragma('synchronous = NORMAL')
  instance.pragma('busy_timeout = 5000')
  return instance
}

/** Abre (una sola vez) la base de datos principal del proceso. */
export function initDatabase(filePath: string): DB {
  if (db) return db
  db = openDatabase(filePath)
  return db
}

export function getDb(): DB {
  if (!db) throw new Error('La base de datos no ha sido inicializada. Llama a initDatabase() primero.')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
