import { Router } from 'express'
import type { DB } from '../db'
import type { AppConfig } from '../config'
import { createBackup, listBackups } from '../backup'
import { getUser } from '../auth'
import { recordAudit } from '../audit'

export function backupRoutes(db: DB, config: AppConfig): Router {
  const router = Router()

  router.get('/backups', (_req, res) => {
    const backups = listBackups(config.backupDir)
    res.json({
      backups,
      lastBackupAt: backups[0]?.createdAt ?? null,
      directory: config.backupDir,
    })
  })

  router.post('/backups', async (req, res) => {
    const user = getUser(req)
    const result = await createBackup(db, config.backupDir, config.backupRetentionDays)
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'backup',
      entityId: 0,
      summary: `Creó manualmente la copia de seguridad ${result.filename}`,
      after: { filename: result.filename, size: result.size },
    })
    res.status(201).json({
      item: {
        filename: result.filename,
        size: result.size,
        createdAt: new Date().toISOString(),
      },
    })
  })

  return router
}
