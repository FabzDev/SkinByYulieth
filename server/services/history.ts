import type { DB } from '../db'
import type { AuditEntry, HistoryEntry, HistoryResponse } from '../../shared/types'
import type { HistoryFlow, HistoryKind } from '../../shared/constants'

const EVENTS_UNION = `
  SELECT
    'sale' AS kind,
    'sale' AS flow,
    s.occurred_at AS occurred_at,
    s.created_at AS created_at,
    substr(s.occurred_at, 1, 10) AS event_date,
    s.total_amount AS amount,
    s.concept AS description,
    s.client_name AS detail,
    s.status AS status,
    s.id AS entity_id,
    s.id AS sale_id,
    cu.name AS user_name,
    s.void_reason AS reason,
    '/ventas/' || s.id AS href
  FROM sales s
  JOIN users cu ON cu.id = s.created_by

  UNION ALL

  SELECT
    'payment',
    'income',
    p.occurred_at,
    p.created_at,
    substr(p.occurred_at, 1, 10),
    p.amount,
    'Pago de ' || s.concept,
    s.client_name,
    p.status,
    p.id,
    p.sale_id,
    cu.name,
    p.void_reason,
    '/ventas/' || p.sale_id
  FROM payments p
  JOIN sales s ON s.id = p.sale_id
  JOIN users cu ON cu.id = p.created_by

  UNION ALL

  SELECT
    'refund',
    'outflow',
    r.occurred_at,
    r.created_at,
    substr(r.occurred_at, 1, 10),
    -r.amount,
    'Devolución de ' || s.concept,
    s.client_name,
    r.status,
    r.id,
    r.sale_id,
    cu.name,
    r.reason,
    '/ventas/' || r.sale_id
  FROM refunds r
  JOIN sales s ON s.id = r.sale_id
  JOIN users cu ON cu.id = r.created_by

  UNION ALL

  SELECT
    'expense',
    'outflow',
    e.occurred_at,
    e.created_at,
    substr(e.occurred_at, 1, 10),
    -e.amount,
    COALESCE(NULLIF(e.description, ''), e.category_name),
    e.category_name,
    e.status,
    e.id,
    NULL,
    cu.name,
    e.void_reason,
    '/gastos/' || e.id
  FROM expenses e
  JOIN users cu ON cu.id = e.created_by

  UNION ALL

  SELECT
    'withdrawal',
    'outflow',
    w.occurred_at,
    w.created_at,
    substr(w.occurred_at, 1, 10),
    -w.amount,
    'Retiro personal',
    w.description,
    w.status,
    w.id,
    NULL,
    cu.name,
    w.void_reason,
    '/retiros/' || w.id
  FROM withdrawals w
  JOIN users cu ON cu.id = w.created_by

  UNION ALL

  SELECT
    'other_income',
    'income',
    o.occurred_at,
    o.created_at,
    substr(o.occurred_at, 1, 10),
    o.amount,
    o.concept,
    CASE WHEN o.source_sale_id IS NOT NULL THEN 'Venta anulada #' || o.source_sale_id ELSE 'Otro ingreso' END,
    o.status,
    o.id,
    o.source_sale_id,
    cu.name,
    o.void_reason,
    '/otros-ingresos/' || o.id
  FROM other_income o
  JOIN users cu ON cu.id = o.created_by

  UNION ALL

  SELECT
    'void',
    'void',
    a.created_at,
    a.created_at,
    substr(a.created_at, 1, 10),
    0,
    a.summary,
    CASE a.entity_type
      WHEN 'sale' THEN 'Venta #' || a.entity_id
      WHEN 'payment' THEN 'Pago #' || a.entity_id
      WHEN 'refund' THEN 'Devolución #' || a.entity_id
      WHEN 'expense' THEN 'Gasto #' || a.entity_id
      WHEN 'withdrawal' THEN 'Retiro #' || a.entity_id
      WHEN 'other_income' THEN 'Otro ingreso #' || a.entity_id
      ELSE a.entity_type
    END,
    'voided',
    a.entity_id,
    CASE WHEN a.entity_type = 'sale' THEN a.entity_id ELSE NULL END,
    cu.name,
    a.reason,
    '/auditoria'
  FROM audit_logs a
  JOIN users cu ON cu.id = a.user_id
  WHERE a.action IN ('voided', 'payment_voided', 'refund_voided')
`

export interface HistoryFilters {
  from?: string
  to?: string
  kind?: HistoryKind | 'all'
  flow?: HistoryFlow | 'all'
  q?: string
  limit?: number
  offset?: number
}

export function listHistory(db: DB, filters: HistoryFilters = {}): HistoryResponse {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.from) {
    conditions.push('event_date >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('event_date <= ?')
    params.push(filters.to)
  }
  if (filters.kind && filters.kind !== 'all') {
    conditions.push('kind = ?')
    params.push(filters.kind)
  }
  if (filters.flow && filters.flow !== 'all') {
    conditions.push('flow = ?')
    params.push(filters.flow)
  }
  if (filters.q) {
    conditions.push('(description LIKE ? OR detail LIKE ? OR user_name LIKE ?)')
    const term = `%${filters.q}%`
    params.push(term, term, term)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db
      .prepare(`WITH events AS (${EVENTS_UNION}) SELECT COUNT(*) AS count FROM events ${where}`)
      .get(...params) as { count: number }
  ).count

  const rows = db
    .prepare(
      `WITH events AS (${EVENTS_UNION})
       SELECT * FROM events ${where}
       ORDER BY occurred_at DESC, created_at DESC, entity_id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Array<Record<string, unknown>>

  const entries: HistoryEntry[] = rows.map((row) => ({
    id: `${String(row.kind)}-${String(row.entity_id)}-${String(row.created_at)}`,
    kind: String(row.kind) as HistoryKind,
    flow: String(row.flow) as HistoryFlow,
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
    amount: Number(row.amount ?? 0),
    description: String(row.description ?? ''),
    detail: row.detail == null ? null : String(row.detail),
    status: String(row.status ?? ''),
    entityId: Number(row.entity_id),
    saleId: row.sale_id == null ? null : Number(row.sale_id),
    userName: String(row.user_name ?? ''),
    reason: row.reason == null ? null : String(row.reason),
    href: row.href == null ? null : String(row.href),
  }))

  return { entries, total, limit, offset }
}

export interface AuditFilters {
  from?: string
  to?: string
  entityType?: string
  userId?: number
  action?: string
  q?: string
  limit?: number
  offset?: number
}

function parseJson(value: unknown): unknown {
  if (value == null) return null
  try {
    return JSON.parse(String(value))
  } catch {
    return null
  }
}

export function listAudit(db: DB, filters: AuditFilters = {}): {
  items: AuditEntry[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.from) {
    conditions.push('substr(a.created_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(a.created_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.entityType) {
    conditions.push('a.entity_type = ?')
    params.push(filters.entityType)
  }
  if (filters.userId) {
    conditions.push('a.user_id = ?')
    params.push(filters.userId)
  }
  if (filters.action) {
    conditions.push('a.action = ?')
    params.push(filters.action)
  }
  if (filters.q) {
    conditions.push('(a.summary LIKE ? OR a.reason LIKE ?)')
    params.push(`%${filters.q}%`, `%${filters.q}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM audit_logs a ${where}`).get(...params) as {
      count: number
    }
  ).count
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS user_name
       FROM audit_logs a
       JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as Array<Record<string, unknown>>

  const items: AuditEntry[] = rows.map((row) => ({
    id: Number(row.id),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: Number(row.entity_id),
    summary: String(row.summary),
    reason: row.reason == null ? null : String(row.reason),
    before: parseJson(row.before_json),
    after: parseJson(row.after_json),
    createdAt: String(row.created_at),
    userName: String(row.user_name),
    userId: Number(row.user_id),
  }))

  return { items, total, limit, offset }
}

export function listUsersForAudit(db: DB): Array<{ id: number; name: string }> {
  return db.prepare('SELECT id, name FROM users ORDER BY name').all() as Array<{
    id: number
    name: string
  }>
}
