import type { DB } from '../db'
import { nowBogota } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { ENTITY_TYPE_LABELS, PAYMENT_METHODS, SALE_STATUS_LABELS } from '../../shared/constants'
import { AUDIT_ACTION_LABELS } from '../../shared/constants'
import { mapPaymentRow, mapRefundRow, mapSaleRow } from './rows'
import { PAYMENT_SELECT, REFUND_SELECT, SALE_SELECT } from './sales'

type CsvValue = string | number | null | undefined

function sanitize(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  let text = String(value)
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`
  }
  return text
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const escape = (value: CsvValue): string => {
    const text = sanitize(value)
    if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function range(column: string, from?: string, to?: string): { sql: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  if (from) {
    conditions.push(`substr(${column}, 1, 10) >= ?`)
    params.push(from)
  }
  if (to) {
    conditions.push(`substr(${column}, 1, 10) <= ?`)
    params.push(to)
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

export function exportSalesCsv(db: DB, from?: string, to?: string): string {
  const filter = range('s.occurred_at', from, to)
  const rows = db
    .prepare(`${SALE_SELECT} ${filter.sql} ORDER BY s.occurred_at ASC, s.id ASC`)
    .all(...filter.params) as Record<string, unknown>[]
  const items = rows.map(mapSaleRow)
  return toCsv(
    [
      'ID',
      'Fecha',
      'Concepto',
      'Cliente',
      'Total COP',
      'Pagado COP',
      'Saldo COP',
      'Estado',
      'Descripción',
      'Registrada por',
      'Anulada por',
      'Fecha anulación',
      'Motivo anulación',
    ],
    items.map((sale) => [
      sale.id,
      sale.occurredAt,
      sale.concept,
      sale.clientName,
      sale.total,
      sale.paid,
      sale.balance,
      SALE_STATUS_LABELS[sale.status],
      sale.description,
      sale.createdByName,
      sale.voidedByName,
      sale.voidedAt,
      sale.voidReason,
    ]),
  )
}

export function exportPaymentsCsv(db: DB, from?: string, to?: string): string {
  const filter = range('p.occurred_at', from, to)
  const rows = db
    .prepare(`${PAYMENT_SELECT} ${filter.sql} ORDER BY p.occurred_at ASC, p.id ASC`)
    .all(...filter.params) as Record<string, unknown>[]
  const items = rows.map(mapPaymentRow)
  return toCsv(
    [
      'ID',
      'Fecha',
      'Venta #',
      'Concepto venta',
      'Valor COP',
      'Método',
      'Estado',
      'Registrado por',
      'Fecha creación',
      'Anulado por',
      'Motivo anulación',
    ],
    items.map((payment) => [
      payment.id,
      payment.occurredAt,
      payment.saleId,
      payment.saleConcept,
      payment.amount,
      PAYMENT_METHODS.find((method) => method.value === payment.method)?.label ?? payment.method,
      payment.status === 'valid' ? 'Válido' : 'Anulado',
      payment.createdByName,
      payment.createdAt,
      payment.voidedByName,
      payment.voidReason,
    ]),
  )
}

export function exportRefundsCsv(db: DB, from?: string, to?: string): string {
  const filter = range('r.occurred_at', from, to)
  const rows = db
    .prepare(`${REFUND_SELECT} ${filter.sql} ORDER BY r.occurred_at ASC, r.id ASC`)
    .all(...filter.params) as Record<string, unknown>[]
  const items = rows.map(mapRefundRow)
  return toCsv(
    ['ID', 'Fecha', 'Venta #', 'Pago #', 'Valor COP', 'Método', 'Motivo', 'Estado', 'Registrado por'],
    items.map((refund) => [
      refund.id,
      refund.occurredAt,
      refund.saleId,
      refund.paymentId,
      refund.amount,
      PAYMENT_METHODS.find((method) => method.value === refund.method)?.label ?? refund.method,
      refund.reason,
      refund.status === 'active' ? 'Activa' : 'Anulada',
      refund.createdByName,
    ]),
  )
}

export function exportExpensesCsv(db: DB, from?: string, to?: string): string {
  const filter = range('e.occurred_at', from, to)
  const rows = db
    .prepare(
      `SELECT e.*, cu.name AS created_by_name, vu.name AS voided_by_name
       FROM expenses e
       JOIN users cu ON cu.id = e.created_by
       LEFT JOIN users vu ON vu.id = e.voided_by
       ${filter.sql}
       ORDER BY e.occurred_at ASC, e.id ASC`,
    )
    .all(...filter.params) as Record<string, unknown>[]
  return toCsv(
    [
      'ID',
      'Fecha',
      'Valor COP',
      'Categoría',
      'Descripción',
      'Comprobante',
      'Estado',
      'Registrado por',
      'Anulado por',
      'Motivo anulación',
    ],
    rows.map((row) => [
      Number(row.id),
      String(row.occurred_at),
      Number(row.amount),
      String(row.category_name),
      row.description == null ? '' : String(row.description),
      row.receipt_filename == null ? 'No' : String(row.receipt_filename),
      String(row.status) === 'active' ? 'Activo' : 'Anulado',
      String(row.created_by_name),
      row.voided_by_name == null ? '' : String(row.voided_by_name),
      row.void_reason == null ? '' : String(row.void_reason),
    ]),
  )
}

export function exportWithdrawalsCsv(db: DB, from?: string, to?: string): string {
  const filter = range('w.occurred_at', from, to)
  const rows = db
    .prepare(
      `SELECT w.*, cu.name AS created_by_name, vu.name AS voided_by_name
       FROM withdrawals w
       JOIN users cu ON cu.id = w.created_by
       LEFT JOIN users vu ON vu.id = w.voided_by
       ${filter.sql}
       ORDER BY w.occurred_at ASC, w.id ASC`,
    )
    .all(...filter.params) as Record<string, unknown>[]
  return toCsv(
    ['ID', 'Fecha', 'Valor COP', 'Descripción', 'Estado', 'Registrado por', 'Anulado por', 'Motivo anulación'],
    rows.map((row) => [
      Number(row.id),
      String(row.occurred_at),
      Number(row.amount),
      row.description == null ? '' : String(row.description),
      String(row.status) === 'active' ? 'Activo' : 'Anulado',
      String(row.created_by_name),
      row.voided_by_name == null ? '' : String(row.voided_by_name),
      row.void_reason == null ? '' : String(row.void_reason),
    ]),
  )
}

export function exportOtherIncomeCsv(db: DB, from?: string, to?: string): string {
  const filter = range('o.occurred_at', from, to)
  const rows = db
    .prepare(
      `SELECT o.*, cu.name AS created_by_name, vu.name AS voided_by_name
       FROM other_income o
       JOIN users cu ON cu.id = o.created_by
       LEFT JOIN users vu ON vu.id = o.voided_by
       ${filter.sql}
       ORDER BY o.occurred_at ASC, o.id ASC`,
    )
    .all(...filter.params) as Record<string, unknown>[]
  return toCsv(
    [
      'ID',
      'Fecha',
      'Valor COP',
      'Concepto',
      'Venta de origen',
      'Estado',
      'Registrado por',
      'Anulado por',
      'Motivo anulación',
    ],
    rows.map((row) => [
      Number(row.id),
      String(row.occurred_at),
      Number(row.amount),
      String(row.concept),
      row.source_sale_id == null ? '' : Number(row.source_sale_id),
      String(row.status) === 'active' ? 'Activo' : 'Anulado',
      String(row.created_by_name),
      row.voided_by_name == null ? '' : String(row.voided_by_name),
      row.void_reason == null ? '' : String(row.void_reason),
    ]),
  )
}

export function exportClientsCsv(db: DB): string {
  const rows = db
    .prepare(
      `SELECT c.*, cu.name AS created_by_name,
        COALESCE((
          SELECT SUM(CASE WHEN s.total_amount > f.paid THEN s.total_amount - f.paid ELSE 0 END)
          FROM sales s JOIN sale_financials f ON f.sale_id = s.id
          WHERE s.client_id = c.id AND s.status = 'active'
        ), 0) AS pending_balance,
        COALESCE((SELECT COUNT(*) FROM sales s WHERE s.client_id = c.id AND s.status = 'active'), 0) AS sales_count
       FROM clients c
       JOIN users cu ON cu.id = c.created_by
       ORDER BY c.name COLLATE NOCASE ASC`,
    )
    .all() as Record<string, unknown>[]
  return toCsv(
    ['ID', 'Nombre', 'Teléfono', 'Saldo pendiente COP', 'Ventas activas', 'Fecha creación', 'Registrado por'],
    rows.map((row) => [
      Number(row.id),
      String(row.name),
      row.phone == null ? '' : String(row.phone),
      Number(row.pending_balance),
      Number(row.sales_count),
      String(row.created_at),
      String(row.created_by_name),
    ]),
  )
}

export function exportAuditCsv(db: DB, from?: string, to?: string): string {
  const filter = range('a.created_at', from, to)
  const rows = db
    .prepare(
      `SELECT a.*, u.name AS user_name
       FROM audit_logs a JOIN users u ON u.id = a.user_id
       ${filter.sql}
       ORDER BY a.created_at ASC, a.id ASC`,
    )
    .all(...filter.params) as Record<string, unknown>[]
  return toCsv(
    ['ID', 'Fecha', 'Usuario', 'Acción', 'Entidad', 'ID entidad', 'Resumen', 'Motivo'],
    rows.map((row) => [
      Number(row.id),
      String(row.created_at),
      String(row.user_name),
      AUDIT_ACTION_LABELS[String(row.action)] ?? String(row.action),
      ENTITY_TYPE_LABELS[String(row.entity_type)] ?? String(row.entity_type),
      Number(row.entity_id),
      String(row.summary),
      row.reason == null ? '' : String(row.reason),
    ]),
  )
}

export function exportFileName(kind: string, from?: string, to?: string): string {
  const stamp = nowBogota().slice(0, 10)
  const suffix = from && to ? `-${from}_${to}` : `-${stamp}`
  return `skinbyyulieth-${kind}${suffix}.csv`
}

export function summaryLine(label: string, amount: number): string {
  return `${label};${formatCOP(amount)}`
}
