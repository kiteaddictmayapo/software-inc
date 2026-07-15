/**
 * Ejecutor de migraciones de esquema.
 *
 * Lee los archivos `NNN_*.sql` de la carpeta `migrations/` en orden y aplica
 * los que aún no estén registrados. La versión aplicada se guarda en
 * settings('schema_version'). Cada migración corre dentro de una transacción.
 */
import type { Database as DB } from 'better-sqlite3'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname_ = dirname(fileURLToPath(import.meta.url))

/** Ubica la carpeta de migraciones en dev (tsx), build (out) y producción (asar/resources). */
export function resolveMigrationsDir(): string {
  const candidates = [
    join(__dirname_, 'migrations'), // dev con tsx: src/main/db/migrations
    join(__dirname_, '../db/migrations'),
    // producción: electron-builder copia la carpeta como extraResource
    process.resourcesPath ? join(process.resourcesPath, 'migrations') : ''
  ].filter(Boolean)
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error('No se encontró la carpeta de migraciones. Buscado en: ' + candidates.join(', '))
}

function getSchemaVersion(db: DB): number {
  // La tabla settings la crea la migración 001. Si aún no existe, versión 0.
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
    .get()
  if (!exists) return 0
  const row = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get() as
    | { value: string }
    | undefined
  return row ? parseInt(row.value, 10) || 0 : 0
}

function setSchemaVersion(db: DB, version: number): void {
  db.prepare(
    `INSERT INTO settings(key, value) VALUES('schema_version', @v)
     ON CONFLICT(key) DO UPDATE SET value=@v, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')`
  ).run({ v: String(version) })
}

export interface MigrationFile {
  version: number
  name: string
  sql: string
}

export function loadMigrations(dir = resolveMigrationsDir()): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .map((f) => {
      const version = parseInt(f.split('_')[0], 10)
      return { version, name: f, sql: readFileSync(join(dir, f), 'utf8') }
    })
    .sort((a, b) => a.version - b.version)
}

/** Aplica todas las migraciones pendientes. Devuelve la versión final. */
export function runMigrations(db: DB, dir?: string): number {
  const current = getSchemaVersion(db)
  const migrations = loadMigrations(dir)
  for (const m of migrations) {
    if (m.version <= current) continue
    const tx = db.transaction(() => {
      db.exec(m.sql)
      setSchemaVersion(db, m.version)
    })
    tx()
  }
  return getSchemaVersion(db)
}
