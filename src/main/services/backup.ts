/**
 * Respaldo y restauración de la base de datos.
 * Usa la Online Backup API de better-sqlite3 (copia consistente aun con WAL).
 */
import { join } from 'node:path'
import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { getDb } from '../db/connection'
import { getPaths } from '../paths'
import { set } from '../repositories/settingsRepo'

const KEEP = 15

/** Crea una copia de la BD en backups/escuela-<timestamp>.db. Devuelve la ruta. */
export async function createBackup(): Promise<string> {
  const paths = getPaths()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(paths.backupsDir, `escuela-${stamp}.db`)
  await getDb().backup(dest)
  set('last_backup_at', new Date().toISOString())
  rotate(paths.backupsDir)
  return dest
}

/** Crea backup automático si el último tiene más de `maxAgeHours`. */
export async function backupIfStale(lastBackupAtISO: string | null, maxAgeHours = 24): Promise<string | null> {
  if (!lastBackupAtISO) return createBackup()
  const age = Date.now() - Date.parse(lastBackupAtISO)
  if (isNaN(age) || age > maxAgeHours * 3600000) return createBackup()
  return null
}

export function listBackups(): { file: string; size: number; mtime: string }[] {
  const dir = getPaths().backupsDir
  return readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const st = statSync(join(dir, f))
      return { file: f, size: st.size, mtime: st.mtime.toISOString() }
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime))
}

function rotate(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('escuela-') && f.endsWith('.db'))
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  for (const old of files.slice(KEEP)) {
    try {
      unlinkSync(join(dir, old.f))
    } catch {
      /* noop */
    }
  }
}
