import type { DB } from '../db'
import type {
  Client,
  ExpenseCategory,
  Payment,
  SaleSummary,
  Service,
  SessionUser,
} from '../../shared/types'
import { nowBogota } from '../../shared/dates'
import { recordAudit } from '../audit'
import { conflict, notFound } from '../errors'
import { mapCategoryRow, mapClientRow, mapServiceRow } from './rows'
import { listPayments, listSales } from './sales'

const SERVICE_SELECT = `
  SELECT s.*, cu.name AS created_by_name, uu.name AS updated_by_name
  FROM services s
  JOIN users cu ON cu.id = s.created_by
  JOIN users uu ON uu.id = s.updated_by
`

export function listServices(db: DB, includeInactive = false): Service[] {
  const rows = db
    .prepare(
      `${SERVICE_SELECT} ${includeInactive ? '' : 'WHERE s.active = 1'}
       ORDER BY s.active DESC, s.name COLLATE NOCASE ASC`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(mapServiceRow)
}

function getService(db: DB, id: number): Service {
  const row = db.prepare(`${SERVICE_SELECT} WHERE s.id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró el servicio.')
  return mapServiceRow(row)
}

function assertUniqueServiceName(db: DB, name: string, excludeId?: number): void {
  const row = db
    .prepare(
      `SELECT id FROM services WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) ${excludeId ? 'AND id <> ?' : ''}`,
    )
    .get(...(excludeId ? [name, excludeId] : [name])) as { id: number } | undefined
  if (row) throw conflict('Ya existe un servicio con ese nombre.', 'duplicate_service')
}

export function createService(
  db: DB,
  user: SessionUser,
  input: { name: string; defaultPrice: number; active?: boolean },
): Service {
  const transaction = db.transaction(() => {
    assertUniqueServiceName(db, input.name)
    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO services (name, default_price, active, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.name.trim(), input.defaultPrice, input.active === false ? 0 : 1, now, now, user.id, user.id)
    const service = getService(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'service',
      entityId: service.id,
      summary: `Creó el servicio "${service.name}"`,
      after: service,
    })
    return service
  })
  return transaction()
}

export function updateService(
  db: DB,
  user: SessionUser,
  id: number,
  input: { name?: string; defaultPrice?: number; active?: boolean },
): Service {
  const transaction = db.transaction(() => {
    const before = getService(db, id)
    const name = input.name?.trim() ?? before.name
    const defaultPrice = input.defaultPrice ?? before.defaultPrice
    const active = input.active ?? before.active

    if (name !== before.name) assertUniqueServiceName(db, name, id)

    const now = nowBogota()
    db.prepare(
      `UPDATE services SET name = ?, default_price = ?, active = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
    ).run(name, defaultPrice, active ? 1 : 0, now, user.id, id)

    const after = getService(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'service',
      entityId: id,
      summary: `Editó el servicio "${before.name}"`,
      before,
      after,
    })
    return after
  })
  return transaction()
}

const CLIENT_SELECT = `
  SELECT
    c.*,
    cu.name AS created_by_name,
    uu.name AS updated_by_name,
    COALESCE((
      SELECT COUNT(*) FROM sales s
      WHERE s.client_id = c.id AND s.status = 'active'
    ), 0) AS sales_count,
    COALESCE((
      SELECT SUM(CASE WHEN s.total_amount > f.paid THEN s.total_amount - f.paid ELSE 0 END)
      FROM sales s
      JOIN sale_financials f ON f.sale_id = s.id
      WHERE s.client_id = c.id AND s.status = 'active'
    ), 0) AS pending_balance
  FROM clients c
  JOIN users cu ON cu.id = c.created_by
  JOIN users uu ON uu.id = c.updated_by
`

export interface ClientFilters {
  q?: string
  limit?: number
  offset?: number
}

export function listClients(db: DB, filters: ClientFilters = {}): {
  items: Client[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.q) {
    conditions.push('(c.name LIKE ? OR c.phone LIKE ?)')
    const term = `%${filters.q}%`
    params.push(term, term)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM clients c ${where}`).get(...params) as { count: number }
  ).count
  const rows = db
    .prepare(`${CLIENT_SELECT} ${where} ORDER BY c.name COLLATE NOCASE ASC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapClientRow), total, limit, offset }
}

function getClient(db: DB, id: number): Client {
  const row = db.prepare(`${CLIENT_SELECT} WHERE c.id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró el cliente.')
  return mapClientRow(row)
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned || null
}

function assertNoDuplicateClient(
  db: DB,
  name: string,
  phone: string | null,
  excludeId?: number,
): void {
  const conditions = ['LOWER(TRIM(name)) = LOWER(TRIM(?))']
  const params: unknown[] = [name]
  if (phone) {
    conditions.push('phone = ?')
    params.push(phone)
  }
  const row = db
    .prepare(
      `SELECT id, name, phone FROM clients
       WHERE (${conditions.join(' OR ')}) ${excludeId ? 'AND id <> ?' : ''}
       LIMIT 1`,
    )
    .get(...(excludeId ? [...params, excludeId] : params)) as
    | { id: number; name: string; phone: string | null }
    | undefined
  if (row) {
    const error = conflict(
      `Ya existe un cliente con datos similares: ${row.name}.`,
      'duplicate_client',
      { existingId: String(row.id), existingName: row.name },
    )
    throw error
  }
}

export function createClient(
  db: DB,
  user: SessionUser,
  input: { name: string; phone?: string | null; allowDuplicate?: boolean },
): Client {
  const transaction = db.transaction(() => {
    const name = input.name.trim()
    const phone = normalizePhone(input.phone)
    if (!input.allowDuplicate) assertNoDuplicateClient(db, name, phone)
    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO clients (name, phone, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(name, phone, now, now, user.id, user.id)
    const client = getClient(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'client',
      entityId: client.id,
      summary: `Creó el cliente "${client.name}"`,
      after: client,
    })
    return client
  })
  return transaction()
}

export function updateClient(
  db: DB,
  user: SessionUser,
  id: number,
  input: { name?: string; phone?: string | null; allowDuplicate?: boolean },
): Client {
  const transaction = db.transaction(() => {
    const before = getClient(db, id)
    const name = input.name?.trim() || before.name
    const phone = input.phone !== undefined ? normalizePhone(input.phone) : before.phone
    if (!input.allowDuplicate && (name !== before.name || phone !== before.phone)) {
      assertNoDuplicateClient(db, name, phone, id)
    }
    const now = nowBogota()
    db.prepare('UPDATE clients SET name = ?, phone = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(
      name,
      phone,
      now,
      user.id,
      id,
    )
    const after = getClient(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'client',
      entityId: id,
      summary: `Editó el cliente "${before.name}"`,
      before,
      after,
    })
    return after
  })
  return transaction()
}

export interface ClientDetail {
  client: Client
  sales: SaleSummary[]
  payments: Payment[]
}

export function getClientDetail(db: DB, id: number): ClientDetail {
  const client = getClient(db, id)
  const sales = listSales(db, { clientId: id, limit: 500 }).items
  const payments = listPayments(db, { clientId: id, limit: 500 }).items
  return { client, sales, payments }
}

const CATEGORY_SELECT = `SELECT * FROM expense_categories`

export function listCategories(db: DB, includeInactive = false): ExpenseCategory[] {
  const rows = db
    .prepare(
      `${CATEGORY_SELECT} ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY active DESC, name COLLATE NOCASE ASC`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(mapCategoryRow)
}

function getCategory(db: DB, id: number): ExpenseCategory {
  const row = db.prepare(`${CATEGORY_SELECT} WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró la categoría.')
  return mapCategoryRow(row)
}

export function createCategory(db: DB, user: SessionUser, input: { name: string }): ExpenseCategory {
  const transaction = db.transaction(() => {
    const existing = db
      .prepare('SELECT id FROM expense_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))')
      .get(input.name) as { id: number } | undefined
    if (existing) throw conflict('Ya existe una categoría con ese nombre.', 'duplicate_category')
    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO expense_categories (name, active, created_at, updated_at, created_by, updated_by)
         VALUES (?, 1, ?, ?, ?, ?)`,
      )
      .run(input.name.trim(), now, now, user.id, user.id)
    const category = getCategory(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'expense_category',
      entityId: category.id,
      summary: `Creó la categoría de gasto "${category.name}"`,
      after: category,
    })
    return category
  })
  return transaction()
}

export function updateCategory(
  db: DB,
  user: SessionUser,
  id: number,
  input: { name?: string; active?: boolean },
): ExpenseCategory {
  const transaction = db.transaction(() => {
    const before = getCategory(db, id)
    const name = input.name?.trim() || before.name
    const active = input.active ?? before.active

    if (name !== before.name) {
      const existing = db
        .prepare(
          'SELECT id FROM expense_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ?',
        )
        .get(name, id) as { id: number } | undefined
      if (existing) throw conflict('Ya existe una categoría con ese nombre.', 'duplicate_category')
    }

    if (!active && before.active) {
      const activeCount = (
        db.prepare('SELECT COUNT(*) AS count FROM expense_categories WHERE active = 1').get() as {
          count: number
        }
      ).count
      if (activeCount <= 1) {
        throw conflict('Debe existir al menos una categoría activa para registrar gastos.')
      }
    }

    const now = nowBogota()
    db.prepare(
      'UPDATE expense_categories SET name = ?, active = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    ).run(name, active ? 1 : 0, now, user.id, id)
    const after = getCategory(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'expense_category',
      entityId: id,
      summary: `Editó la categoría de gasto "${before.name}"`,
      before,
      after,
    })
    return after
  })
  return transaction()
}
