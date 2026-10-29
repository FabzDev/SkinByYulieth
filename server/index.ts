import { loadConfig } from './config'
import { closeDatabase, openDatabase } from './db'
import { createApp } from './app'
import { startBackupScheduler } from './backup'

const config = loadConfig()
const db = openDatabase(config.databasePath)
const app = createApp({ db, config })
const scheduler = startBackupScheduler(
  db,
  config.backupDir,
  config.backupIntervalMinutes,
  config.backupRetentionDays,
)

const users = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count

const server = app.listen(config.port, () => {
  console.log('')
  console.log('  SkinByYulieth · gestión contable')
  console.log(`  Servidor: http://localhost:${config.port}`)
  console.log(`  Base de datos: ${config.databasePath}`)
  console.log(`  Copias de seguridad: ${config.backupDir}`)
  console.log(`  Entorno: ${config.isProduction ? 'producción' : 'desarrollo'}`)
  if (!config.isProduction) {
    console.log('  Interfaz de desarrollo: http://localhost:5173')
  }
  if (users === 0) {
    console.log('')
    console.log('  Aún no hay usuarios. Crea las cuentas con:')
    console.log('    npm run user:create')
  }
  console.log('')
})

function shutdown(signal: string): void {
  console.log(`\n[app] Cerrando (${signal})...`)
  scheduler.stop()
  server.close(() => {
    closeDatabase(db)
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
