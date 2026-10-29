import { Router } from 'express'
import { z } from 'zod'
import type { DB } from '../db'
import { getUser } from '../auth'
import { nonNegativeMoneySchema, paginationSchema, parseId, parseWithSchema, requiredText, optionalText, booleanFlexible } from '../validation'
import {
  createCategory,
  createClient,
  createService,
  getClientDetail,
  listCategories,
  listClients,
  listServices,
  updateCategory,
  updateClient,
  updateService,
} from '../services/catalog'

const serviceCreateSchema = z.object({
  name: requiredText(120),
  defaultPrice: nonNegativeMoneySchema,
  active: z.boolean().optional(),
})

const serviceUpdateSchema = z.object({
  name: requiredText(120).optional(),
  defaultPrice: nonNegativeMoneySchema.optional(),
  active: z.boolean().optional(),
})

const categoryCreateSchema = z.object({
  name: requiredText(120),
})

const categoryUpdateSchema = z.object({
  name: requiredText(120).optional(),
  active: z.boolean().optional(),
})

const clientCreateSchema = z.object({
  name: requiredText(120),
  phone: optionalText(40),
  allowDuplicate: z.boolean().optional(),
})

const clientUpdateSchema = z.object({
  name: requiredText(120).optional(),
  phone: optionalText(40),
  allowDuplicate: z.boolean().optional(),
})

export function catalogRoutes(db: DB): Router {
  const router = Router()

  router.get('/services', (req, res) => {
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true'
    res.json({ items: listServices(db, includeInactive) })
  })

  router.post('/services', (req, res) => {
    const input = parseWithSchema(serviceCreateSchema, req.body)
    res.status(201).json({ item: createService(db, getUser(req), input) })
  })

  router.patch('/services/:id', (req, res) => {
    const id = parseId(req.params.id)
    const input = parseWithSchema(serviceUpdateSchema, req.body)
    res.json({ item: updateService(db, getUser(req), id, input) })
  })

  router.get('/expense-categories', (req, res) => {
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true'
    res.json({ items: listCategories(db, includeInactive) })
  })

  router.post('/expense-categories', (req, res) => {
    const input = parseWithSchema(categoryCreateSchema, req.body)
    res.status(201).json({ item: createCategory(db, getUser(req), input) })
  })

  router.patch('/expense-categories/:id', (req, res) => {
    const id = parseId(req.params.id)
    const input = parseWithSchema(categoryUpdateSchema, req.body)
    res.json({ item: updateCategory(db, getUser(req), id, input) })
  })

  router.get('/clients', (req, res) => {
    const pagination = parseWithSchema(paginationSchema, req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    res.json(listClients(db, { ...pagination, q }))
  })

  router.get('/clients/:id', (req, res) => {
    res.json(getClientDetail(db, parseId(req.params.id)))
  })

  router.post('/clients', (req, res) => {
    const input = parseWithSchema(clientCreateSchema, req.body)
    res.status(201).json({ item: createClient(db, getUser(req), input) })
  })

  router.patch('/clients/:id', (req, res) => {
    const id = parseId(req.params.id)
    const input = parseWithSchema(clientUpdateSchema, req.body)
    res.json({ item: updateClient(db, getUser(req), id, input) })
  })

  return router
}
