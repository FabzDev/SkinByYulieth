import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import { ZodError } from 'zod'
import type { DB } from './db'
import { isDatabaseHealthy } from './db'
import type { AppConfig } from './config'
import { requireAuth } from './auth'
import { AppError } from './errors'
import { nowBogota } from '../shared/dates'
import { authRoutes } from './routes/auth'
import { catalogRoutes } from './routes/catalog'
import { salesRoutes } from './routes/sales'
import { recordsRoutes } from './routes/records'
import { reportingRoutes } from './routes/reporting'
import { exportRoutes } from './routes/exports'
import { backupRoutes } from './routes/backups'

function originProtection(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next()
      return
    }

    const fetchSite = req.get('sec-fetch-site')
    if (fetchSite === 'cross-site') {
      next(new AppError('Solicitud rechazada por protección de origen.', 403, { code: 'csrf' }))
      return
    }

    const origin = req.get('origin')
    if (origin) {
      const allowed = new Set([config.appOrigin])
      const ownOrigin = `${req.protocol}://${req.get('host')}`
      allowed.add(ownOrigin)
      if (!allowed.has(origin)) {
        next(new AppError('Solicitud rechazada por protección de origen.', 403, { code: 'csrf' }))
        return
      }
    }

    next()
  }
}

export interface AppDependencies {
  db: DB
  config: AppConfig
}

export function createApp({ db, config }: AppDependencies): express.Express {
  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )
  app.use(originProtection(config))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/health', (_req, res) => {
    const healthy = isDatabaseHealthy(db)
    res.status(healthy ? 200 : 503).json({
      ok: healthy,
      time: nowBogota(),
      service: 'skinbyyulieth',
    })
  })

  app.use('/api/auth', authRoutes(db, config))
  app.use('/api', requireAuth(db, config))
  app.use('/api', catalogRoutes(db))
  app.use('/api', salesRoutes(db))
  app.use('/api', recordsRoutes(db, config))
  app.use('/api', reportingRoutes(db))
  app.use('/api', exportRoutes(db))
  app.use('/api', backupRoutes(db, config))

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'No se encontró el recurso solicitado.', code: 'not_found' })
  })

  if (config.isProduction) {
    app.use(
      express.static(config.clientDir, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store')
        },
      }),
    )
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      const indexFile = path.join(config.clientDir, 'index.html')
      if (!fs.existsSync(indexFile)) {
        res
          .status(503)
          .type('text/plain')
          .send('La interfaz no está compilada. Ejecuta npm run build antes de iniciar en producción.')
        return
      }
      res.setHeader('Cache-Control', 'no-store')
      res.sendFile(indexFile)
    })
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'No se encontró el recurso solicitado.', code: 'not_found' })
  })

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      })
      return
    }

    if (error instanceof ZodError) {
      const details: Record<string, string> = {}
      for (const issue of error.issues) {
        const key = issue.path.length ? issue.path.join('.') : 'general'
        if (!details[key]) details[key] = issue.message
      }
      res.status(400).json({
        error: 'Los datos enviados no son válidos.',
        code: 'validation_error',
        details,
      })
      return
    }

    const err = error as { code?: string; type?: string; status?: number; message?: string }

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: `El comprobante supera el tamaño máximo permitido (${Math.round(config.maxReceiptBytes / 1024 / 1024)} MB).`,
        code: 'file_too_large',
      })
      return
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        error: 'Solo se permite un archivo de comprobante.',
        code: 'unexpected_file',
      })
      return
    }

    if (error instanceof SyntaxError && err.status === 400) {
      res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.', code: 'bad_json' })
      return
    }

    if (err.code?.startsWith('SQLITE_CONSTRAINT')) {
      res.status(409).json({
        error: 'La operación entra en conflicto con otro registro existente.',
        code: 'constraint',
      })
      return
    }

    console.error(`[error] ${req.method} ${req.originalUrl}`, error)
    res.status(500).json({
      error: 'Ocurrió un error inesperado. Intenta de nuevo.',
      code: 'internal_error',
    })
  })

  return app
}
