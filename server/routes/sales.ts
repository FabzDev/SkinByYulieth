import { Router } from 'express'
import { z } from 'zod'
import type { DB } from '../db'
import { getUser } from '../auth'
import {
  localDateSchema,
  localDateTimeSchema,
  moneySchema,
  optionalText,
  parseId,
  parseWithSchema,
  paymentMethodSchema,
  requiredText,
} from '../validation'
import {
  createPayment,
  createRefund,
  createSale,
  getSaleDetail,
  listPayments,
  listSales,
  updatePayment,
  updateSale,
  voidPayment,
  voidRefund,
  voidSale,
} from '../services/sales'

const saleListQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  status: z.enum(['all', 'active', 'open', 'pending', 'partial', 'paid', 'voided']).optional(),
  q: z.string().trim().max(200).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const saleCreateSchema = z.object({
  serviceId: z.number().int().positive().nullable().optional(),
  concept: requiredText(200).optional(),
  clientId: z.number().int().positive().nullable().optional(),
  clientName: optionalText(120),
  total: moneySchema,
  occurredAt: localDateTimeSchema,
  description: optionalText(500),
})

const saleUpdateSchema = z.object({
  concept: requiredText(200).optional(),
  clientId: z.number().int().positive().nullable().optional(),
  clientName: optionalText(120),
  total: moneySchema.optional(),
  occurredAt: localDateTimeSchema.optional(),
  description: optionalText(500),
})

const voidSaleSchema = z.object({
  reason: optionalText(500),
  paymentAction: z.enum(['void', 'refund', 'retain']).nullable().optional(),
})

const paymentListQuery = z.object({
  saleId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  status: z.enum(['all', 'valid', 'voided']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const paymentCreateSchema = z.object({
  saleId: z.number().int().positive(),
  amount: moneySchema,
  occurredAt: localDateTimeSchema,
  method: paymentMethodSchema,
})

const paymentUpdateSchema = z.object({
  amount: moneySchema.optional(),
  occurredAt: localDateTimeSchema.optional(),
  method: paymentMethodSchema.optional(),
})

const voidSchema = z.object({
  reason: optionalText(500),
})

const refundCreateSchema = z.object({
  paymentId: z.number().int().positive(),
  amount: moneySchema,
  occurredAt: localDateTimeSchema,
  method: paymentMethodSchema,
  reason: optionalText(500),
})

export function salesRoutes(db: DB): Router {
  const router = Router()

  router.get('/sales', (req, res) => {
    const query = parseWithSchema(saleListQuery, req.query)
    res.json(listSales(db, query))
  })

  router.get('/sales/open', (req, res) => {
    const query = parseWithSchema(saleListQuery, req.query)
    res.json(listSales(db, { ...query, status: 'open' }))
  })

  router.get('/sales/:id', (req, res) => {
    res.json({ item: getSaleDetail(db, parseId(req.params.id)) })
  })

  router.post('/sales', (req, res) => {
    const input = parseWithSchema(saleCreateSchema, req.body)
    res.status(201).json({ item: createSale(db, getUser(req), input) })
  })

  router.patch('/sales/:id', (req, res) => {
    const input = parseWithSchema(saleUpdateSchema, req.body)
    res.json({ item: updateSale(db, getUser(req), parseId(req.params.id), input) })
  })

  router.post('/sales/:id/void', (req, res) => {
    const input = parseWithSchema(voidSaleSchema, req.body)
    res.json({ item: voidSale(db, getUser(req), parseId(req.params.id), input) })
  })

  router.post('/sales/:id/refunds', (req, res) => {
    const input = parseWithSchema(refundCreateSchema, req.body)
    res.status(201).json({ item: createRefund(db, getUser(req), parseId(req.params.id), input) })
  })

  router.get('/payments', (req, res) => {
    const query = parseWithSchema(paymentListQuery, req.query)
    res.json(listPayments(db, query))
  })

  router.post('/payments', (req, res) => {
    const input = parseWithSchema(paymentCreateSchema, req.body)
    res.status(201).json({ item: createPayment(db, getUser(req), input) })
  })

  router.patch('/payments/:id', (req, res) => {
    const input = parseWithSchema(paymentUpdateSchema, req.body)
    res.json({ item: updatePayment(db, getUser(req), parseId(req.params.id), input) })
  })

  router.post('/payments/:id/void', (req, res) => {
    const input = parseWithSchema(voidSchema, req.body)
    res.json({ item: voidPayment(db, getUser(req), parseId(req.params.id), input.reason ?? null) })
  })

  router.post('/refunds/:id/void', (req, res) => {
    const input = parseWithSchema(voidSchema, req.body)
    res.json({ item: voidRefund(db, getUser(req), parseId(req.params.id), input.reason ?? null) })
  })

  return router
}
