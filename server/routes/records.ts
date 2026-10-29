import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import type { DB } from '../db'
import type { AppConfig } from '../config'
import { getUser } from '../auth'
import { ALLOWED_RECEIPT_TYPES } from '../../shared/constants'
import {
  booleanFlexible,
  localDateSchema,
  localDateTimeSchema,
  moneySchema,
  optionalText,
  parseId,
  parseWithSchema,
  requiredText,
} from '../validation'
import { badRequest } from '../errors'
import {
  createExpense,
  createOtherIncome,
  createWithdrawal,
  getExpense,
  getExpenseReceipt,
  getOtherIncome,
  getWithdrawal,
  listExpenses,
  listOtherIncome,
  listWithdrawals,
  updateExpense,
  updateOtherIncome,
  updateWithdrawal,
  voidExpense,
  voidOtherIncome,
  voidWithdrawal,
} from '../services/records'

const recordListQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  status: z.enum(['all', 'active', 'voided']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const expenseListQuery = recordListQuery.extend({
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(200).optional(),
})

const expenseCreateSchema = z.object({
  amount: moneySchema,
  categoryId: z.coerce.number().int().positive(),
  occurredAt: localDateTimeSchema,
  description: optionalText(500),
})

const expenseUpdateSchema = z.object({
  amount: moneySchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  occurredAt: localDateTimeSchema.optional(),
  description: optionalText(500),
})

const removeReceiptSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === '') return undefined
    return value === true || value === 'true' || value === 'on' || value === '1'
  },
  z.boolean().optional(),
)

const withdrawalCreateSchema = z.object({
  amount: moneySchema,
  occurredAt: localDateTimeSchema,
  description: optionalText(500),
})

const withdrawalUpdateSchema = z.object({
  amount: moneySchema.optional(),
  occurredAt: localDateTimeSchema.optional(),
  description: optionalText(500),
})

const otherIncomeCreateSchema = z.object({
  amount: moneySchema,
  occurredAt: localDateTimeSchema,
  concept: requiredText(200),
})

const otherIncomeUpdateSchema = z.object({
  amount: moneySchema.optional(),
  occurredAt: localDateTimeSchema.optional(),
  concept: requiredText(200).optional(),
})

const voidSchema = z.object({
  reason: optionalText(500),
})

function receiptFrom(req: Express.Request): {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
} | null {
  const file = req.file
  if (!file) return null
  if (!ALLOWED_RECEIPT_TYPES.includes(file.mimetype as (typeof ALLOWED_RECEIPT_TYPES)[number])) {
    throw badRequest('El comprobante debe ser una imagen JPG, PNG, WEBP o un PDF.')
  }
  return {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  }
}

export function recordsRoutes(db: DB, config: AppConfig): Router {
  const router = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxReceiptBytes, files: 1 },
  })

  router.get('/expenses', (req, res) => {
    const query = parseWithSchema(expenseListQuery, req.query)
    res.json(listExpenses(db, query))
  })

  router.get('/expenses/:id', (req, res) => {
    res.json({ item: getExpense(db, parseId(req.params.id)) })
  })

  router.post('/expenses', upload.single('receipt'), (req, res) => {
    const input = parseWithSchema(expenseCreateSchema, req.body)
    const item = createExpense(db, getUser(req), {
      ...input,
      receipt: receiptFrom(req),
    })
    res.status(201).json({ item })
  })

  router.patch('/expenses/:id', upload.single('receipt'), (req, res) => {
    const input = parseWithSchema(
      expenseUpdateSchema.extend({ removeReceipt: removeReceiptSchema }),
      req.body,
    )
    const item = updateExpense(db, getUser(req), parseId(req.params.id), {
      ...input,
      receipt: receiptFrom(req),
    })
    res.json({ item })
  })

  router.post('/expenses/:id/void', (req, res) => {
    const input = parseWithSchema(voidSchema, req.body)
    res.json({ item: voidExpense(db, getUser(req), parseId(req.params.id), input.reason ?? null) })
  })

  router.get('/expenses/:id/receipt', (req, res) => {
    const receipt = getExpenseReceipt(db, parseId(req.params.id))
    res.setHeader('Content-Type', receipt.mimeType)
    res.setHeader('Content-Length', String(receipt.size))
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(receipt.filename)}`,
    )
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.send(receipt.buffer)
  })

  router.get('/withdrawals', (req, res) => {
    const query = parseWithSchema(recordListQuery, req.query)
    res.json(listWithdrawals(db, query))
  })

  router.get('/withdrawals/:id', (req, res) => {
    res.json({ item: getWithdrawal(db, parseId(req.params.id)) })
  })

  router.post('/withdrawals', (req, res) => {
    const input = parseWithSchema(withdrawalCreateSchema, req.body)
    res.status(201).json({ item: createWithdrawal(db, getUser(req), input) })
  })

  router.patch('/withdrawals/:id', (req, res) => {
    const input = parseWithSchema(withdrawalUpdateSchema, req.body)
    res.json({ item: updateWithdrawal(db, getUser(req), parseId(req.params.id), input) })
  })

  router.post('/withdrawals/:id/void', (req, res) => {
    const input = parseWithSchema(voidSchema, req.body)
    res.json({ item: voidWithdrawal(db, getUser(req), parseId(req.params.id), input.reason ?? null) })
  })

  router.get('/other-income', (req, res) => {
    const query = parseWithSchema(recordListQuery, req.query)
    res.json(listOtherIncome(db, query))
  })

  router.get('/other-income/:id', (req, res) => {
    res.json({ item: getOtherIncome(db, parseId(req.params.id)) })
  })

  router.post('/other-income', (req, res) => {
    const input = parseWithSchema(otherIncomeCreateSchema, req.body)
    res.status(201).json({ item: createOtherIncome(db, getUser(req), input) })
  })

  router.patch('/other-income/:id', (req, res) => {
    const input = parseWithSchema(otherIncomeUpdateSchema, req.body)
    res.json({ item: updateOtherIncome(db, getUser(req), parseId(req.params.id), input) })
  })

  router.post('/other-income/:id/void', (req, res) => {
    const input = parseWithSchema(voidSchema, req.body)
    res.json({ item: voidOtherIncome(db, getUser(req), parseId(req.params.id), input.reason ?? null) })
  })

  return router
}
