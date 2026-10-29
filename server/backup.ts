import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { DB } from './db'
import { nowBogota } from '../shared/dates'
import type { BackupInfo } from '../shared/types'

export interface BackupResult {
  filename: string
  path: string
  size: number
}

export async function createBackup(
  db: DB,
  directory: string,
  retentionDays = 30,
): Promise<BackupResult> {
  fs.mkdirSync(directory, { recursive: true })
  const stamp = nowBogota().replace(/[: ]/g, '-')
  const filename = `skinbyyulieth-${stamp}.db`
  const destination = path.join(directory, filename)

  await db.backup(destination)

  // Verificar que la copia se pueda abrir y esté íntegra.
  const copy = new Database(destination, { readonly: true, fileMustExist: true })
  try {
    const result = copy.pragma('integrity_check', { simple: true })
    if (result !== 'ok') {
      throw new Error(`La copia de seguridad no pasó la verificación: ${String(result)}`)
    }
  } catch (error) {
    copy.close()
    fs.rmSync(destination, { force: true })
    throw error
  }
  copy.close()

  pruneBackups(directory, retentionDays)
  const stats = fs.statSync(destination)
  return { filename, path: destination, size: stats.size }
}

export function pruneBackups(directory: string, retentionDays: number): void {
  if (!fs.existsSync(directory)) return
  const cutoff = Date.now() - retentionDays * 86_400_000
  for (const name of fs.readdirSync(directory)) {
    if (!name.startsWith('skinbyyulieth-') || !name.endsWith('.db')) continue
    const full = path.join(directory, name)
    try {
      const stats = fs.statSync(full)
      if (stats.mtimeMs < cutoff) fs.rmSync(full, { force: true })
    } catch {
      // Si un archivo no se puede leer, se ignora; no debe tumbar el respaldo.
    }
  }
}

export function listBackups(directory: string): BackupInfo[] {
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory)
    .filter((name) => name.startsWith('skinbyyulieth-') && name.endsWith('.db'))
    .map((filename) => {
      const stats = fs.statSync(path.join(directory, filename))
      return {
        filename,
        size: stats.size,
        createdAt: nowBogota(stats.mtime),
      }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export interface BackupScheduler {
  stop: () => void
}

export function startBackupScheduler(
  db: DB,
  directory: string,
  intervalMinutes: number,
  retentionDays: number,
): BackupScheduler {
  let running = false

  const run = async (reason: string): Promise<void> => {
    if (running) return
    running = true
    try {
      const result = await createBackup(db, directory, retentionDays)
      console.log(
        `[backup] Copia creada (${reason}): ${result.filename} (${Math.round(result.size / 1024)} KB)`,
      )
    } catch (error) {
      console.error('[backup] Falló la copia de seguridad:', error)
    } finally {
      running = false
    }
  }

  const initial = setTimeout(() => void run('inicio'), 15_000)
  initial.unref()

  const timer = setInterval(
    () => void run('programada'),
    Math.max(intervalMinutes, 5) * 60_000,
  )
  timer.unref()

  return {
    stop: () => {
      clearTimeout(initial)
      clearInterval(timer)
    },
  }
}
