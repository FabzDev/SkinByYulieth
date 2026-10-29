import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import type { DB } from '../server/db'
import { closeDatabase } from '../server/db'
import type { AppConfig } from '../server/config'
import { createApp } from '../server/app'
import { hashPassword } from '../server/auth'
import { createTestDb } from './helpers'

let db: DB
let app: Express
let agent: ReturnType<typeof request.agent>
const password = 'ClaveSegura123'

const config: AppConfig = {
  isProduction: false,
  port: 3001,
  databasePath: ':memory:',
  backupDir: './backups-test',
  backupRetentionDays: 30,
  backupIntervalMinutes: 1440,
  appOrigin: 'http://localhost:5173',
  sessionSecret: 'test-secret-123456789012345678901234',
  sessionDays: 30,
  cookieSecure: false,
  maxReceiptBytes: 5 * 1024 * 1024,
  clientDir: './dist/client',
  trustProxy: false,
}

beforeAll(async () => {
  const test = createTestDb()
  db = test.db
  const hash = await hashPassword(password, 4)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hash)
  app = createApp({ db, config })
  agent = request.agent(app)
})

afterAll(() => {
  closeDatabase(db)
})

describe('Autenticación y autorización', () => {
  it('rechaza endpoints privados sin sesión', async () => {
    const response = await request(app).get('/api/dashboard')
    expect(response.status).toBe(401)
    expect(response.body.code).toBe('unauthorized')
  })

  it('rechaza credenciales incorrectas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'yulieth@test.local', password: 'incorrecta' })
    expect(response.status).toBe(401)
  })

  it('inicia sesión y permite consultar el tablero', async () => {
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'YULIETH@test.local', password })
    expect(login.status).toBe(200)
    expect(login.body.user.name).toBe('Yulieth')
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly')

    const dashboard = await agent.get('/api/dashboard?from=2026-10-01&to=2026-10-31')
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.received.total).toBe(0)
  })

  it('rechaza solicitudes de otro origen', async () => {
    const response = await agent
      .post('/api/clients')
      .set('Origin', 'https://sitio-malicioso.example')
      .send({ name: 'Intruso' })
    expect(response.status).toBe(403)
  })
})

describe('API de ventas y pagos', () => {
  it('registra venta, pago parcial y evita sobrepagos', async () => {
    const sale = await agent.post('/api/sales').send({
      concept: 'Limpieza facial',
      total: 140000,
      occurredAt: '2026-10-05T10:00',
      clientName: 'Ana',
    })
    expect(sale.status).toBe(201)
    const saleId = sale.body.item.id
    expect(sale.body.item.status).toBe('pending')

    const payment = await agent.post('/api/payments').send({
      saleId,
      amount: 100000,
      occurredAt: '2026-10-05T10:30',
      method: 'cash',
    })
    expect(payment.status).toBe(201)
    expect(payment.body.item.status).toBe('partial')
    expect(payment.body.item.balance).toBe(40000)

    const overpayment = await agent.post('/api/payments').send({
      saleId,
      amount: 40001,
      occurredAt: '2026-10-05T11:00',
      method: 'cash',
    })
    expect(overpayment.status).toBe(400)
    expect(overpayment.body.code).toBe('payment_exceeds_balance')

    const dashboard = await agent.get('/api/dashboard?from=2026-10-01&to=2026-10-31')
    expect(dashboard.body.received.total).toBe(100000)
    expect(dashboard.body.pending.total).toBe(40000)
  })

  it('valida datos faltantes y fechas inválidas', async () => {
    const missingConcept = await agent.post('/api/sales').send({
      total: 10000,
      occurredAt: '2026-10-05T10:00',
    })
    expect(missingConcept.status).toBe(400)

    const invalidDate = await agent.post('/api/sales').send({
      concept: 'Prueba',
      total: 10000,
      occurredAt: '2026-02-30T10:00',
    })
    expect(invalidDate.status).toBe(400)
    expect(invalidDate.body.code).toBe('validation_error')
  })
})

describe('Comprobantes de gastos', () => {
  it('sube un PDF y lo sirve solo con sesión', async () => {
    const expense = await agent
      .post('/api/expenses')
      .field('amount', '25000')
      .field('categoryId', '1')
      .field('occurredAt', '2026-10-07T09:00')
      .field('description', 'Productos')
      .attach('receipt', Buffer.from('%PDF-1.4 comprobante de prueba'), {
        filename: 'factura.pdf',
        contentType: 'application/pdf',
      })
    expect(expense.status).toBe(201)
    expect(expense.body.item.receipt.filename).toBe('factura.pdf')

    const receipt = await agent.get(`/api/expenses/${expense.body.item.id}/receipt`)
    expect(receipt.status).toBe(200)
    expect(receipt.headers['content-type']).toContain('application/pdf')

    const anonymous = await request(app).get(`/api/expenses/${expense.body.item.id}/receipt`)
    expect(anonymous.status).toBe(401)
  })

  it('rechaza tipos de archivo no permitidos', async () => {
    const expense = await agent
      .post('/api/expenses')
      .field('amount', '25000')
      .field('categoryId', '1')
      .field('occurredAt', '2026-10-07T09:00')
      .attach('receipt', Buffer.from('<script>alert(1)</script>'), {
        filename: 'malware.html',
        contentType: 'text/html',
      })
    expect(expense.status).toBe(400)
  })
})

describe('Exportaciones', () => {
  it('exporta CSV autenticado con encabezados claros', async () => {
    const response = await agent.get('/api/export/ventas?from=2026-10-01&to=2026-10-31')
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.text).toContain('ID;Fecha;Concepto;Cliente')
    expect(response.text).toContain('Limpieza facial')
    expect(response.text).toContain('\uFEFF')
  })

  it('no expone la exportación sin sesión', async () => {
    const response = await request(app).get('/api/export/ventas')
    expect(response.status).toBe(401)
  })
})
