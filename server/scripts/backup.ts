import { loadConfig } from '../config'
import { closeDatabase, openDatabase } from '../db'
import { createBackup } from '../backup'

async function main(): Promise<void> {
  const config = loadConfig()
  const db = openDatabase(config.databasePath)
  try {
    const result = await createBackup(db, config.backupDir, config.backupRetentionDays)
    console.log(`Copia de seguridad creada: ${result.path}`)
    console.log(`Tamaño: ${(result.size / 1024).toFixed(1)} KB`)
  } finally {
    closeDatabase(db)
  }
}

main().catch((error) => {
  console.error('No se pudo crear la copia de seguridad:', error)
  process.exit(1)
})
