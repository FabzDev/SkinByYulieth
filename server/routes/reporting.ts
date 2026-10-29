import { Router } from 'express'
import { z } from 'zod'
import type { DB } from '../db'
import { currentMonthRange } from '../../shared/dates'
import { localDateSchema, parseWithSchema } from '../validation'
import { getDashboard } from '../services/sales'
import { listAudit, listHistory, listUsersForAudit } from '../services/history'
import { AppError } from '../errors'

const dashboardQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
})

const historyQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  kind: z
    .enum(['all', 'sale', 'payment', 'refund', 'expense', 'withdrawal', 'other_income', 'void'])
    .optional(),
  flow: z.enum(['all', 'sale', 'income', 'outflow', 'void']).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const auditQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  entityType: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  userId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export function reportingRoutes(db: DB): Router {
  const router = Router()

  router.get('/dashboard', (req, res) => {
    const query = parseWithSchema(dashboardQuery, req.query)
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new AppError('Debes indicar la fecha inicial y la fecha final.', 400, {
        code: 'invalid_range',
      })
    }
    const range = query.from && query.to ? { from: query.from, to: query.to } : currentMonthRange()
    if (range.from > range.to) {
      throw new AppError('La fecha inicial no puede ser posterior a la fecha final.', 400, {
        code: 'invalid_range',
      })
    }
    res.json(getDashboard(db, range.from, range.to))
  })

  router.get('/history', (req, res) => {
    const query = parseWithSchema(historyQuery, req.query)
    res.json(listHistory(db, query))
  })

  router.get('/audit', (req, res) => {
    const query = parseWithSchema(auditQuery, req.query)
    res.json(listAudit(db, query))
  })

  router.get('/audit/users', (_req, res) => {
    res.json({ items: listUsersForAudit(db) })
  })

  return router
}
