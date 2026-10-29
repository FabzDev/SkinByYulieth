import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

export interface AppConfig {
  isProduction: boolean
  port: number
  databasePath: string
  backupDir: string
  backupRetentionDays: number
  backupIntervalMinutes: number
  appOrigin: string
  sessionSecret: string
  sessionDays: number
  cookieSecure: boolean
  maxReceiptBytes: number
  clientDir: string
  trustProxy: boolean
}

const DEFAULT_DEV_SECRET = 'skinbyyulieth-dev-secret-change-me-in-production-1234567890'

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const isProduction = (overrides.isProduction ?? process.env.NODE_ENV === 'production') === true
  const sessionSecret = overrides.sessionSecret ?? process.env.SESSION_SECRET ?? ''

  if (isProduction && (!sessionSecret || sessionSecret === DEFAULT_DEV_SECRET)) {
    throw new Error(
      'SESSION_SECRET es obligatorio en producción y no puede ser el valor de desarrollo. Configúralo en .env.',
    )
  }

  const maxReceiptMb = Number(process.env.MAX_RECEIPT_MB ?? 5)

  const config: AppConfig = {
    isProduction,
    port: Number(process.env.PORT ?? 3001),
    databasePath: path.resolve(process.env.DATABASE_PATH ?? './data/skinbyyulieth.db'),
    backupDir: path.resolve(process.env.BACKUP_DIR ?? './backups'),
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30),
    backupIntervalMinutes: Number(process.env.BACKUP_INTERVAL_MINUTES ?? 1440),
    appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    sessionSecret: sessionSecret || DEFAULT_DEV_SECRET,
    sessionDays: Number(process.env.SESSION_DAYS ?? 30),
    cookieSecure:
      (process.env.COOKIE_SECURE ?? (isProduction ? 'true' : 'false')).toLowerCase() === 'true',
    maxReceiptBytes: (Number.isFinite(maxReceiptMb) ? maxReceiptMb : 5) * 1024 * 1024,
    clientDir: path.resolve(process.env.CLIENT_DIR ?? './dist/client'),
    trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
    ...overrides,
  }

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error('PORT debe ser un número válido.')
  }
  if (!Number.isInteger(config.backupRetentionDays) || config.backupRetentionDays < 1) {
    throw new Error('BACKUP_RETENTION_DAYS debe ser un entero mayor que cero.')
  }
  if (!Number.isFinite(config.sessionDays) || config.sessionDays < 1) {
    throw new Error('SESSION_DAYS debe ser mayor que cero.')
  }

  return config
}
