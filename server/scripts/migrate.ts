import { loadConfig } from '../config'
import { closeDatabase, openDatabase } from '../db'

const config = loadConfig()
const db = openDatabase(config.databasePath)
const migrations = db
  .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')
  .all() as Array<{ version: number; name: string; applied_at: string }>

console.log(`Base de datos: ${config.databasePath}`)
console.log(`Migraciones aplicadas: ${migrations.length}`)
for (const migration of migrations) {
  console.log(`  ${String(migration.version).padStart(3, '0')} · ${migration.name} · ${migration.applied_at}`)
}
closeDatabase(db)
