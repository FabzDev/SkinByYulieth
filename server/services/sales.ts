import type { DB } from '../db'
import type {
  DashboardData,
  SessionUser,
  Payment,
  Refund,
  SaleDetail,
  SaleSummary,
} from '../../shared/types'
import type { PaymentMethod } from '../../shared/constants'
import { nowBogota } from '../../shared/dates'
import { recordAudit } from '../audit'
import { AppError, badRequest, conflict, notFound } from '../errors'
import { mapPaymentRow, mapRefundRow, mapSaleRow } from './rows'

export type PaymentAction = 'void' | 'refund' | 'retain'

export const SALE_SELECT = `
  SELECT
    s.id, s.service_id, s.concept, s.client_id, s.client_name, s.total_amount,
    s.occurred_at, s.description, s.status, s.voided_at, s.voided_by, s.void_reason,
    s.created_at, s.updated_at, s.created_by, s.updated_by,
    f.paid, f.refunded, f.payments_count, f.last_payment_at,
    cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS voided_by_name
  FROM sales s
  JOIN sale_financials f ON f.sale_id = s.id
  JOIN users cu ON cu.id = s.created_by
  JOIN users uu ON uu.id = s.updated_by
  LEFT JOIN users vu ON vu.id = s.voided_by
`

export const PAYMENT_SELECT = `
  SELECT
    p.id, p.sale_id, p.amount, p.occurred_at, p.method, p.status,
    p.voided_at, p.voided_by, p.void_reason,
    p.created_at, p.updated_at, p.created_by, p.updated_by,
    s.concept AS sale_concept,
    cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS voided_by_name,
    (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r WHERE r.payment_id = p.id AND r.status = 'active') AS refunded
  FROM payments p
  JOIN sales s ON s.id = p.sale_id
  JOIN users cu ON cu.id = p.created_by
  JOIN users uu ON uu.id = p.updated_by
  LEFT JOIN users vu ON vu.id = p.voided_by
`

export const REFUND_SELECT = `
  SELECT
    r.id, r.sale_id, r.payment_id, r.amount, r.occurred_at, r.method, r.reason, r.status,
    r.voided_at, r.voided_by, r.void_reason, r.created_at,
    cu.name AS created_by_name, vu.name AS voided_by_name
  FROM refunds r
  JOIN users cu ON cu.id = r.created_by
  LEFT JOIN users vu ON vu.id = r.voided_by
`

function getSaleSummary(db: DB, id: number): SaleSummary {
  const row = db.prepare(`${SALE_SELECT} WHERE s.id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró la venta.')
  return mapSaleRow(row)
}

export function getSaleDetail(db: DB, id: number): SaleDetail {
  const sale = getSaleSummary(db, id)
  const payments = (
    db.prepare(`${PAYMENT_SELECT} WHERE p.sale_id = ? ORDER BY p.occurred_at ASC, p.id ASC`).all(id) as Record<
      string,
      unknown
    >[]
  ).map(mapPaymentRow)
  const refunds = (
    db.prepare(`${REFUND_SELECT} WHERE r.sale_id = ? ORDER BY r.occurred_at ASC, r.id ASC`).all(id) as Record<
      string,
      unknown
    >[]
  ).map(mapRefundRow)
  return { ...sale, payments, refunds }
}

export interface SaleFilters {
  from?: string
  to?: string
  clientId?: number
  status?: 'all' | 'active' | 'open' | 'pending' | 'partial' | 'paid' | 'voided'
  q?: string
  limit?: number
  offset?: number
}

export interface SaleListResult {
  items: SaleSummary[]
  total: number
  limit: number
  offset: number
}

export function listSales(db: DB, filters: SaleFilters = {}): SaleListResult {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.from) {
    conditions.push('substr(s.occurred_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(s.occurred_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.clientId) {
    conditions.push('s.client_id = ?')
    params.push(filters.clientId)
  }
  if (filters.q) {
    conditions.push('(s.concept LIKE ? OR s.client_name LIKE ? OR s.description LIKE ?)')
    const term = `%${filters.q}%`
    params.push(term, term, term)
  }

  switch (filters.status) {
    case 'active':
      conditions.push("s.status = 'active'")
      break
    case 'open':
      conditions.push("s.status = 'active' AND f.paid < s.total_amount")
      break
    case 'pending':
      conditions.push("s.status = 'active' AND f.paid <= 0")
      break
    case 'partial':
      conditions.push("s.status = 'active' AND f.paid > 0 AND f.paid < s.total_amount")
      break
    case 'paid':
      conditions.push("s.status = 'active' AND f.paid >= s.total_amount")
      break
    case 'voided':
      conditions.push("s.status = 'voided'")
      break
    default:
      break
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM sales s JOIN sale_financials f ON f.sale_id = s.id ${where}`)
      .get(...params) as { count: number }
  ).count
  const rows = db
    .prepare(`${SALE_SELECT} ${where} ORDER BY s.occurred_at DESC, s.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]

  return { items: rows.map(mapSaleRow), total: count, limit, offset }
}

export interface CreateSaleInput {
  serviceId?: number | null
  concept?: string
  clientId?: number | null
  clientName?: string | null
  total: number
  occurredAt: string
  description?: string | null
}

export function createSale(db: DB, user: SessionUser, input: CreateSaleInput): SaleDetail {
  const transaction = db.transaction(() => {
    let serviceId: number | null = null
    let concept = input.concept?.trim() ?? ''
    let total = input.total

    if (input.serviceId) {
      const service = db
        .prepare('SELECT id, name, default_price, active FROM services WHERE id = ?')
        .get(input.serviceId) as
        | { id: number; name: string; default_price: number; active: number }
        | undefined
      if (!service) throw notFound('El servicio seleccionado no existe.')
      if (service.active !== 1) {
        throw badRequest('El servicio seleccionado está inactivo. Elige otro o usa un concepto personalizado.')
      }
      serviceId = service.id
      concept = service.name
      if (!total) total = service.default_price
    }

    if (!concept) throw badRequest('El concepto de la venta es obligatorio.')
    if (!Number.isSafeInteger(total) || total <= 0) {
      throw badRequest('El precio de la venta debe ser un valor positivo en pesos.')
    }

    let clientId: number | null = null
    let clientName: string | null = null
    if (input.clientId) {
      const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(input.clientId) as
        | { id: number; name: string }
        | undefined
      if (!client) throw notFound('El cliente seleccionado no existe.')
      clientId = client.id
      clientName = client.name
    } else {
      clientName = input.clientName?.trim() || null
    }

    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO sales
          (service_id, concept, client_id, client_name, total_amount, occurred_at, description, status,
           created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      )
      .run(
        serviceId,
        concept,
        clientId,
        clientName,
        total,
        input.occurredAt,
        input.description?.trim() || null,
        now,
        now,
        user.id,
        user.id,
      )
    const saleId = Number(result.lastInsertRowid)
    const sale = getSaleSummary(db, saleId)

    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'sale',
      entityId: saleId,
      summary: `Registró la venta #${saleId} (${concept})`,
      after: sale,
    })

    return getSaleDetail(db, saleId)
  })

  return transaction()
}

export interface UpdateSaleInput {
  concept?: string
  clientId?: number | null
  clientName?: string | null
  total?: number
  occurredAt?: string
  description?: string | null
}

export function updateSale(db: DB, user: SessionUser, id: number, input: UpdateSaleInput): SaleDetail {
  const transaction = db.transaction(() => {
    const before = getSaleSummary(db, id)
    if (before.status === 'voided') throw conflict('Una venta anulada no se puede editar.')

    const total = input.total ?? before.total
    if (total < before.paid) {
      throw conflict(
        `El total no puede ser menor que el dinero ya recibido (${before.paid}). Registra una devolución o anula los pagos primero.`,
        'total_below_paid',
      )
    }

    let clientId = before.clientId
    let clientName = before.clientName
    if (input.clientId !== undefined) {
      if (input.clientId) {
        const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(input.clientId) as
          | { id: number; name: string }
          | undefined
        if (!client) throw notFound('El cliente seleccionado no existe.')
        clientId = client.id
        clientName = client.name
      } else {
        clientId = null
        clientName = input.clientName?.trim() || null
      }
    } else if (input.clientName !== undefined && !before.clientId) {
      clientName = input.clientName?.trim() || null
    }

    const concept = input.concept?.trim() || before.concept
    const description =
      input.description !== undefined ? input.description?.trim() || null : before.description
    const occurredAt = input.occurredAt ?? before.occurredAt
    const now = nowBogota()

    db.prepare(
      `UPDATE sales
       SET concept = ?, client_id = ?, client_name = ?, total_amount = ?, occurred_at = ?, description = ?,
           updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(concept, clientId, clientName, total, occurredAt, description, now, user.id, id)

    const after = getSaleSummary(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'sale',
      entityId: id,
      summary: `Editó la venta #${id} (${after.concept})`,
      before,
      after,
    })
    return getSaleDetail(db, id)
  })

  return transaction()
}

export interface VoidSaleInput {
  reason?: string | null
  paymentAction?: PaymentAction | null
}

export function voidSale(db: DB, user: SessionUser, id: number, input: VoidSaleInput): SaleDetail {
  const transaction = db.transaction(() => {
    const before = getSaleDetail(db, id)
    if (before.status === 'voided') throw conflict('La venta ya está anulada.')

    const paid = before.paid
    if (paid > 0 && !input.paymentAction) {
      throw new AppError(
        'La venta tiene pagos recibidos. Indica qué ocurrió con ese dinero antes de anularla.',
        400,
        { code: 'payment_action_required' },
      )
    }

    const now = nowBogota()
    const reason = input.reason?.trim() || null
    const action = paid > 0 ? input.paymentAction : null
    const validPayments = before.payments.filter((payment) => payment.status === 'valid')

    if (action === 'void' || action === 'retain') {
      for (const payment of validPayments) {
        db.prepare(
          `UPDATE payments
           SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND status = 'valid'`,
        ).run(
          now,
          user.id,
          reason ? `Venta anulada: ${reason}` : 'Venta anulada',
          now,
          user.id,
          payment.id,
        )
        const afterPayment = mapPaymentRow(
          db.prepare(`${PAYMENT_SELECT} WHERE p.id = ?`).get(payment.id) as Record<string, unknown>,
        )
        recordAudit(db, {
          userId: user.id,
          action: 'payment_voided',
          entityType: 'payment',
          entityId: payment.id,
          summary: `Anuló el pago #${payment.id} de la venta #${id} al anular la venta`,
          reason,
          before: payment,
          after: afterPayment,
        })
      }
    }

    if (action === 'retain') {
      const result = db
        .prepare(
          `INSERT INTO other_income
            (amount, occurred_at, concept, source_sale_id, status, created_at, updated_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .run(
          paid,
          now,
          `Dinero retenido por venta anulada #${id}: ${before.concept}`,
          id,
          now,
          now,
          user.id,
          user.id,
        )
      const otherIncomeId = Number(result.lastInsertRowid)
      const created = db.prepare('SELECT * FROM other_income WHERE id = ?').get(otherIncomeId) as Record<
        string,
        unknown
      >
      recordAudit(db, {
        userId: user.id,
        action: 'created',
        entityType: 'other_income',
        entityId: otherIncomeId,
        summary: `Registró como otro ingreso el dinero retenido de la venta anulada #${id}`,
        after: created,
      })
    }

    if (action === 'refund') {
      for (const payment of validPayments) {
        const refunded = payment.refunded ?? 0
        const refundable = payment.amount - refunded
        if (refundable <= 0) continue
        const result = db
          .prepare(
            `INSERT INTO refunds
              (sale_id, payment_id, amount, occurred_at, method, reason, status,
               created_at, updated_at, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
          )
          .run(
            id,
            payment.id,
            refundable,
            now,
            payment.method,
            reason ?? 'Devolución por venta anulada',
            now,
            now,
            user.id,
            user.id,
          )
        const refund = mapRefundRow(
          db.prepare(`${REFUND_SELECT} WHERE r.id = ?`).get(Number(result.lastInsertRowid)) as Record<
            string,
            unknown
          >,
        )
        recordAudit(db, {
          userId: user.id,
          action: 'refund_created',
          entityType: 'refund',
          entityId: refund.id,
          summary: `Registró la devolución #${refund.id} por la venta anulada #${id}`,
          reason,
          after: refund,
        })
      }
    }

    db.prepare(
      `UPDATE sales
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)

    const after = getSaleDetail(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'voided',
      entityType: 'sale',
      entityId: id,
      summary: `Anuló la venta #${id} (${before.concept})`,
      reason,
      before,
      after: { ...after, paymentAction: action },
    })
    return after
  })

  return transaction()
}

export interface PaymentFilters {
  saleId?: number
  clientId?: number
  from?: string
  to?: string
  status?: 'all' | 'valid' | 'voided'
  limit?: number
  offset?: number
}

export function listPayments(db: DB, filters: PaymentFilters = {}): {
  items: Payment[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.saleId) {
    conditions.push('p.sale_id = ?')
    params.push(filters.saleId)
  }
  if (filters.clientId) {
    conditions.push('s.client_id = ?')
    params.push(filters.clientId)
  }
  if (filters.from) {
    conditions.push('substr(p.occurred_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(p.occurred_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.status === 'valid') conditions.push("p.status = 'valid'")
  if (filters.status === 'voided') conditions.push("p.status = 'voided'")

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM payments p JOIN sales s ON s.id = p.sale_id ${where}`)
      .get(...params) as { count: number }
  ).count
  const rows = db
    .prepare(`${PAYMENT_SELECT} ${where} ORDER BY p.occurred_at DESC, p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapPaymentRow), total, limit, offset }
}

function getPayment(db: DB, id: number): Payment {
  const row = db.prepare(`${PAYMENT_SELECT} WHERE p.id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró el pago.')
  return mapPaymentRow(row)
}

export interface CreatePaymentInput {
  saleId: number
  amount: number
  occurredAt: string
  method: PaymentMethod
}

export function createPayment(db: DB, user: SessionUser, input: CreatePaymentInput): SaleDetail {
  const transaction = db.transaction(() => {
    const sale = getSaleSummary(db, input.saleId)
    if (sale.status === 'voided') throw conflict('No se pueden registrar pagos en una venta anulada.')
    if (sale.balance <= 0) throw conflict('La venta ya está pagada por completo.', 'sale_already_paid')
    if (input.amount > sale.balance) {
      throw new AppError(
        `El pago supera el saldo pendiente de la venta (${sale.balance} pesos).`,
        400,
        { code: 'payment_exceeds_balance', details: { available: String(sale.balance) } },
      )
    }

    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO payments
          (sale_id, amount, occurred_at, method, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, 'valid', ?, ?, ?, ?)`,
      )
      .run(input.saleId, input.amount, input.occurredAt, input.method, now, now, user.id, user.id)
    const paymentId = Number(result.lastInsertRowid)
    const payment = getPayment(db, paymentId)

    recordAudit(db, {
      userId: user.id,
      action: 'payment_created',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Registró un pago de ${input.amount} pesos para la venta #${sale.id} (${sale.concept})`,
      after: { ...payment, saleConcept: sale.concept },
    })
    return getSaleDetail(db, input.saleId)
  })

  return transaction()
}

export interface UpdatePaymentInput {
  amount?: number
  occurredAt?: string
  method?: PaymentMethod
}

export function updatePayment(db: DB, user: SessionUser, id: number, input: UpdatePaymentInput): SaleDetail {
  const transaction = db.transaction(() => {
    const before = getPayment(db, id)
    if (before.status === 'voided') throw conflict('Un pago anulado no se puede editar.')
    const sale = getSaleSummary(db, before.saleId)
    const amount = input.amount ?? before.amount
    const occurredAt = input.occurredAt ?? before.occurredAt
    const method = input.method ?? before.method

    const otherPaid = (
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
           WHERE sale_id = ? AND status = 'valid' AND id <> ?`,
        )
        .get(before.saleId, id) as { total: number }
    ).total

    if (otherPaid + amount > sale.total) {
      throw new AppError(
        `El pago supera el saldo pendiente de la venta (${sale.total - otherPaid} pesos disponibles).`,
        400,
        { code: 'payment_exceeds_balance', details: { available: String(sale.total - otherPaid) } },
      )
    }
    if (before.refunded > 0 && amount < before.refunded) {
      throw conflict(
        `El pago tiene devoluciones por ${before.refunded} pesos. El valor no puede ser menor.`,
        'payment_below_refunded',
      )
    }

    const now = nowBogota()
    db.prepare(
      `UPDATE payments SET amount = ?, occurred_at = ?, method = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
    ).run(amount, occurredAt, method, now, user.id, id)

    const after = getPayment(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'payment_updated',
      entityType: 'payment',
      entityId: id,
      summary: `Editó el pago #${id} de la venta #${before.saleId}`,
      before,
      after,
    })
    return getSaleDetail(db, before.saleId)
  })

  return transaction()
}

export function voidPayment(db: DB, user: SessionUser, id: number, reason: string | null): SaleDetail {
  const transaction = db.transaction(() => {
    const before = getPayment(db, id)
    if (before.status === 'voided') throw conflict('El pago ya está anulado.')
    if (before.refunded > 0) {
      throw conflict(
        'El pago tiene devoluciones asociadas. Anula primero las devoluciones para conservar la coherencia.',
        'refund_exists',
      )
    }

    const now = nowBogota()
    db.prepare(
      `UPDATE payments
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)

    const after = getPayment(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'payment_voided',
      entityType: 'payment',
      entityId: id,
      summary: `Anuló el pago #${id} de la venta #${before.saleId}`,
      reason,
      before,
      after,
    })
    return getSaleDetail(db, before.saleId)
  })

  return transaction()
}

export interface CreateRefundInput {
  paymentId: number
  amount: number
  occurredAt: string
  method: PaymentMethod
  reason?: string | null
}

export function createRefund(db: DB, user: SessionUser, saleId: number, input: CreateRefundInput): SaleDetail {
  const transaction = db.transaction(() => {
    const sale = getSaleSummary(db, saleId)
    if (sale.status !== 'voided') {
      throw conflict(
        'Solo se registran devoluciones de ventas anuladas. Anula la venta primero.',
        'sale_not_voided',
      )
    }
    const payment = getPayment(db, input.paymentId)
    if (payment.saleId !== saleId) throw badRequest('El pago no pertenece a esta venta.')
    if (payment.status !== 'valid') throw conflict('No se puede devolver un pago anulado.')

    const refundable = payment.amount - payment.refunded
    if (input.amount > refundable) {
      throw new AppError(
        `La devolución supera el valor disponible del pago (${refundable} pesos).`,
        400,
        { code: 'refund_exceeds_payment', details: { available: String(refundable) } },
      )
    }

    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO refunds
          (sale_id, payment_id, amount, occurred_at, method, reason, status,
           created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      )
      .run(
        saleId,
        input.paymentId,
        input.amount,
        input.occurredAt,
        input.method,
        input.reason?.trim() || null,
        now,
        now,
        user.id,
        user.id,
      )
    const refund = mapRefundRow(
      db.prepare(`${REFUND_SELECT} WHERE r.id = ?`).get(Number(result.lastInsertRowid)) as Record<
        string,
        unknown
      >,
    )
    recordAudit(db, {
      userId: user.id,
      action: 'refund_created',
      entityType: 'refund',
      entityId: refund.id,
      summary: `Registró una devolución de ${input.amount} pesos para la venta #${saleId}`,
      reason: refund.reason,
      after: refund,
    })
    return getSaleDetail(db, saleId)
  })

  return transaction()
}

export function voidRefund(db: DB, user: SessionUser, id: number, reason: string | null): SaleDetail {
  const transaction = db.transaction(() => {
    const row = db.prepare(`${REFUND_SELECT} WHERE r.id = ?`).get(id) as Record<string, unknown> | undefined
    if (!row) throw notFound('No se encontró la devolución.')
    const before = mapRefundRow(row)
    if (before.status === 'voided') throw conflict('La devolución ya está anulada.')

    const now = nowBogota()
    db.prepare(
      `UPDATE refunds
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)

    const afterRow = db.prepare(`${REFUND_SELECT} WHERE r.id = ?`).get(id) as Record<string, unknown>
    const after = mapRefundRow(afterRow)
    recordAudit(db, {
      userId: user.id,
      action: 'refund_voided',
      entityType: 'refund',
      entityId: id,
      summary: `Anuló la devolución #${id} de la venta #${before.saleId}`,
      reason,
      before,
      after,
    })
    return getSaleDetail(db, before.saleId)
  })

  return transaction()
}

function scalar(db: DB, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as { value: number } | undefined
  return Number(row?.value ?? 0)
}

export function getDashboard(db: DB, from: string, to: string): DashboardData {
  const payments = scalar(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS value FROM payments
     WHERE status = 'valid' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const otherIncome = scalar(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS value FROM other_income
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const refunds = scalar(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS value FROM refunds
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const expenses = scalar(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS value FROM expenses
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const withdrawals = scalar(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS value FROM withdrawals
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const salesTotal = scalar(
    db,
    `SELECT COALESCE(SUM(total_amount), 0) AS value FROM sales
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )
  const salesCount = scalar(
    db,
    `SELECT COUNT(*) AS value FROM sales
     WHERE status = 'active' AND substr(occurred_at, 1, 10) BETWEEN ? AND ?`,
    from,
    to,
  )

  const pendingRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN s.total_amount > f.paid THEN s.total_amount - f.paid ELSE 0 END), 0) AS total,
         COALESCE(SUM(CASE WHEN s.total_amount > f.paid THEN 1 ELSE 0 END), 0) AS sales_count,
         COALESCE(SUM(CASE WHEN f.paid > 0 AND f.paid < s.total_amount THEN 1 ELSE 0 END), 0) AS partial_count
       FROM sales s
       JOIN sale_financials f ON f.sale_id = s.id
       WHERE s.status = 'active'`,
    )
    .get() as { total: number; sales_count: number; partial_count: number }

  const receivedTotal = payments + otherIncome - refunds

  return {
    from,
    to,
    received: {
      payments,
      otherIncome,
      refunds,
      total: receivedTotal,
    },
    expenses,
    estimatedProfit: receivedTotal - expenses,
    withdrawals,
    pending: {
      total: Number(pendingRow.total ?? 0),
      salesCount: Number(pendingRow.sales_count ?? 0),
    },
    salesTotal,
    salesCount,
    pendingSalesCount: Number(pendingRow.sales_count ?? 0),
    partialSalesCount: Number(pendingRow.partial_count ?? 0),
  }
}
