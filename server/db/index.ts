import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

export type DB = Database.Database

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

export interface OpenDatabaseOptions {
  readonly?: boolean
  skipMigrations?: boolean
}

export function openDatabase(filename: string, options: OpenDatabaseOptions = {}): DB {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true })
  }

  const db = new Database(filename, {
    readonly: options.readonly ?? false,
    fileMustExist: options.readonly ?? false,
  })

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')

  if (!options.skipMigrations) {
    runMigrations(db)
    ensureDefaultCategories(db)
  }

  return db
}

export function runMigrations(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: number }).version),
  )

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = Number(file.split('_')[0])
    if (!Number.isInteger(version)) continue
    if (applied.has(version)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const now = new Date().toISOString()
    const transaction = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        version,
        file,
        now,
      )
    })
    transaction()
  }
}

function ensureDefaultCategories(db: DB): void {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM expense_categories').get() as { count: number })
    .count
  if (count > 0) return

  const defaults = [
    'Productos y suministros',
    'Arriendo y servicios públicos',
    'Equipos y muebles',
    'Otros gastos',
  ]

  const insert = db.prepare(
    `INSERT INTO expense_categories (name, active, created_at, updated_at, created_by, updated_by)
     VALUES (?, 1, ?, ?, NULL, NULL)`,
  )
  const now = new Date().toISOString()
  const transaction = db.transaction(() => {
    for (const name of defaults) insert.run(name, now, now)
  })
  transaction()
}

export function closeDatabase(db: DB): void {
  try {
    db.close()
  } catch {
    // Ignorar cierre repetido.
  }
}

export function isDatabaseHealthy(db: DB): boolean {
  try {
    db.prepare('SELECT 1').get()
    return true
  } catch {
    return false
  }
}
