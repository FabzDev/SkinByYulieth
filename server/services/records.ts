import type { DB } from '../db'
import type {
  Expense,
  OtherIncome,
  SessionUser,
  Withdrawal,
} from '../../shared/types'
import { nowBogota } from '../../shared/dates'
import { recordAudit } from '../audit'
import { badRequest, conflict, notFound } from '../errors'
import { mapExpenseRow, mapOtherIncomeRow, mapWithdrawalRow } from './rows'

export interface ReceiptFile {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

const EXPENSE_SELECT = `
  SELECT e.*, cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS voided_by_name
  FROM expenses e
  JOIN users cu ON cu.id = e.created_by
  JOIN users uu ON uu.id = e.updated_by
  LEFT JOIN users vu ON vu.id = e.voided_by
`

export function getExpense(db: DB, id: number): Expense {
  const row = db.prepare(`${EXPENSE_SELECT} WHERE e.id = ?`).get(id) as Record<string, unknown> | undefined
  if (!row) throw notFound('No se encontró el gasto.')
  return mapExpenseRow(row)
}

export interface ExpenseFilters {
  from?: string
  to?: string
  categoryId?: number
  status?: 'all' | 'active' | 'voided'
  q?: string
  limit?: number
  offset?: number
}

export function listExpenses(db: DB, filters: ExpenseFilters = {}): {
  items: Expense[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.from) {
    conditions.push('substr(e.occurred_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(e.occurred_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.categoryId) {
    conditions.push('e.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters.status === 'active') conditions.push("e.status = 'active'")
  if (filters.status === 'voided') conditions.push("e.status = 'voided'")
  if (filters.q) {
    conditions.push('(e.description LIKE ? OR e.category_name LIKE ?)')
    const term = `%${filters.q}%`
    params.push(term, term)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM expenses e ${where}`).get(...params) as { count: number }
  ).count
  const rows = db
    .prepare(`${EXPENSE_SELECT} ${where} ORDER BY e.occurred_at DESC, e.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapExpenseRow), total, limit, offset }
}

export interface CreateExpenseInput {
  amount: number
  categoryId: number
  occurredAt: string
  description?: string | null
  receipt?: ReceiptFile | null
}

function getActiveCategory(db: DB, id: number, allowInactive = false): { id: number; name: string } {
  const category = db
    .prepare('SELECT id, name, active FROM expense_categories WHERE id = ?')
    .get(id) as { id: number; name: string; active: number } | undefined
  if (!category) throw notFound('La categoría seleccionada no existe.')
  if (!allowInactive && category.active !== 1) {
    throw badRequest('La categoría seleccionada está inactiva.')
  }
  return { id: category.id, name: category.name }
}

function cleanFilename(name: string): string {
  return name.replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]+/g, '_').slice(0, 180) || 'comprobante'
}

export function createExpense(db: DB, user: SessionUser, input: CreateExpenseInput): Expense {
  const transaction = db.transaction(() => {
    const category = getActiveCategory(db, input.categoryId)
    const receipt = input.receipt ?? null
    if (receipt && receipt.size <= 0) throw badRequest('El comprobante está vacío.')

    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO expenses
          (amount, category_id, category_name, occurred_at, description,
           receipt_blob, receipt_filename, receipt_mime, receipt_size,
           status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      )
      .run(
        input.amount,
        category.id,
        category.name,
        input.occurredAt,
        input.description?.trim() || null,
        receipt?.buffer ?? null,
        receipt ? cleanFilename(receipt.originalname) : null,
        receipt?.mimetype ?? null,
        receipt?.size ?? null,
        now,
        now,
        user.id,
        user.id,
      )
    const expense = getExpense(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'expense',
      entityId: expense.id,
      summary: `Registró un gasto de ${input.amount} pesos en "${category.name}"`,
      after: expense,
    })
    return expense
  })
  return transaction()
}

export interface UpdateExpenseInput {
  amount?: number
  categoryId?: number
  occurredAt?: string
  description?: string | null
  receipt?: ReceiptFile | null
  removeReceipt?: boolean
}

export function updateExpense(
  db: DB,
  user: SessionUser,
  id: number,
  input: UpdateExpenseInput,
): Expense {
  const transaction = db.transaction(() => {
    const before = getExpense(db, id)
    if (before.status === 'voided') throw conflict('Un gasto anulado no se puede editar.')

    const categoryId = input.categoryId ?? before.categoryId
    const category =
      categoryId === before.categoryId
        ? { id: before.categoryId, name: before.categoryName }
        : getActiveCategory(db, categoryId)
    const amount = input.amount ?? before.amount
    const occurredAt = input.occurredAt ?? before.occurredAt
    const description =
      input.description !== undefined ? input.description?.trim() || null : before.description

    let receiptBlob: Buffer | null | undefined
    let receiptFilename: string | null | undefined
    let receiptMime: string | null | undefined
    let receiptSize: number | null | undefined

    if (input.removeReceipt) {
      receiptBlob = null
      receiptFilename = null
      receiptMime = null
      receiptSize = null
    } else if (input.receipt) {
      if (input.receipt.size <= 0) throw badRequest('El comprobante está vacío.')
      receiptBlob = input.receipt.buffer
      receiptFilename = cleanFilename(input.receipt.originalname)
      receiptMime = input.receipt.mimetype
      receiptSize = input.receipt.size
    }

    const now = nowBogota()
    if (receiptBlob !== undefined) {
      db.prepare(
        `UPDATE expenses
         SET amount = ?, category_id = ?, category_name = ?, occurred_at = ?, description = ?,
             receipt_blob = ?, receipt_filename = ?, receipt_mime = ?, receipt_size = ?,
             updated_at = ?, updated_by = ?
         WHERE id = ?`,
      ).run(
        amount,
        category.id,
        category.name,
        occurredAt,
        description,
        receiptBlob,
        receiptFilename ?? null,
        receiptMime ?? null,
        receiptSize ?? null,
        now,
        user.id,
        id,
      )
    } else {
      db.prepare(
        `UPDATE expenses
         SET amount = ?, category_id = ?, category_name = ?, occurred_at = ?, description = ?,
             updated_at = ?, updated_by = ?
         WHERE id = ?`,
      ).run(amount, category.id, category.name, occurredAt, description, now, user.id, id)
    }

    const after = getExpense(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'expense',
      entityId: id,
      summary: `Editó el gasto #${id} (${before.categoryName})`,
      before,
      after,
    })
    return after
  })
  return transaction()
}

export function voidExpense(db: DB, user: SessionUser, id: number, reason: string | null): Expense {
  const transaction = db.transaction(() => {
    const before = getExpense(db, id)
    if (before.status === 'voided') throw conflict('El gasto ya está anulado.')
    const now = nowBogota()
    db.prepare(
      `UPDATE expenses
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)
    const after = getExpense(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'voided',
      entityType: 'expense',
      entityId: id,
      summary: `Anuló el gasto #${id} (${before.categoryName})`,
      reason,
      before,
      after,
    })
    return after
  })
  return transaction()
}

export interface ExpenseReceipt {
  buffer: Buffer
  filename: string
  mimeType: string
  size: number
}

export function getExpenseReceipt(db: DB, id: number): ExpenseReceipt {
  const row = db
    .prepare(
      `SELECT receipt_blob, receipt_filename, receipt_mime, receipt_size FROM expenses WHERE id = ?`,
    )
    .get(id) as
    | {
        receipt_blob: Buffer | null
        receipt_filename: string | null
        receipt_mime: string | null
        receipt_size: number | null
      }
    | undefined
  if (!row) throw notFound('No se encontró el gasto.')
  if (!row.receipt_blob) throw notFound('Este gasto no tiene comprobante.')
  return {
    buffer: row.receipt_blob,
    filename: row.receipt_filename ?? 'comprobante',
    mimeType: row.receipt_mime ?? 'application/octet-stream',
    size: row.receipt_size ?? row.receipt_blob.length,
  }
}

const WITHDRAWAL_SELECT = `
  SELECT w.*, cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS voided_by_name
  FROM withdrawals w
  JOIN users cu ON cu.id = w.created_by
  JOIN users uu ON uu.id = w.updated_by
  LEFT JOIN users vu ON vu.id = w.voided_by
`

export function getWithdrawal(db: DB, id: number): Withdrawal {
  const row = db.prepare(`${WITHDRAWAL_SELECT} WHERE w.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) throw notFound('No se encontró el retiro.')
  return mapWithdrawalRow(row)
}

export interface RecordFilters {
  from?: string
  to?: string
  status?: 'all' | 'active' | 'voided'
  limit?: number
  offset?: number
}

export function listWithdrawals(db: DB, filters: RecordFilters = {}): {
  items: Withdrawal[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.from) {
    conditions.push('substr(w.occurred_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(w.occurred_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.status === 'active') conditions.push("w.status = 'active'")
  if (filters.status === 'voided') conditions.push("w.status = 'voided'")
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM withdrawals w ${where}`).get(...params) as {
      count: number
    }
  ).count
  const rows = db
    .prepare(`${WITHDRAWAL_SELECT} ${where} ORDER BY w.occurred_at DESC, w.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapWithdrawalRow), total, limit, offset }
}

export function createWithdrawal(
  db: DB,
  user: SessionUser,
  input: { amount: number; occurredAt: string; description?: string | null },
): Withdrawal {
  const transaction = db.transaction(() => {
    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO withdrawals
          (amount, occurred_at, description, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      )
      .run(input.amount, input.occurredAt, input.description?.trim() || null, now, now, user.id, user.id)
    const withdrawal = getWithdrawal(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'withdrawal',
      entityId: withdrawal.id,
      summary: `Registró un retiro personal de ${input.amount} pesos`,
      after: withdrawal,
    })
    return withdrawal
  })
  return transaction()
}

export function updateWithdrawal(
  db: DB,
  user: SessionUser,
  id: number,
  input: { amount?: number; occurredAt?: string; description?: string | null },
): Withdrawal {
  const transaction = db.transaction(() => {
    const before = getWithdrawal(db, id)
    if (before.status === 'voided') throw conflict('Un retiro anulado no se puede editar.')
    const now = nowBogota()
    db.prepare(
      `UPDATE withdrawals SET amount = ?, occurred_at = ?, description = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(
      input.amount ?? before.amount,
      input.occurredAt ?? before.occurredAt,
      input.description !== undefined ? input.description?.trim() || null : before.description,
      now,
      user.id,
      id,
    )
    const after = getWithdrawal(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'withdrawal',
      entityId: id,
      summary: `Editó el retiro personal #${id}`,
      before,
      after,
    })
    return after
  })
  return transaction()
}

export function voidWithdrawal(db: DB, user: SessionUser, id: number, reason: string | null): Withdrawal {
  const transaction = db.transaction(() => {
    const before = getWithdrawal(db, id)
    if (before.status === 'voided') throw conflict('El retiro ya está anulado.')
    const now = nowBogota()
    db.prepare(
      `UPDATE withdrawals
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)
    const after = getWithdrawal(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'voided',
      entityType: 'withdrawal',
      entityId: id,
      summary: `Anuló el retiro personal #${id}`,
      reason,
      before,
      after,
    })
    return after
  })
  return transaction()
}

const OTHER_INCOME_SELECT = `
  SELECT o.*, cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS voided_by_name
  FROM other_income o
  JOIN users cu ON cu.id = o.created_by
  JOIN users uu ON uu.id = o.updated_by
  LEFT JOIN users vu ON vu.id = o.voided_by
`

export function getOtherIncome(db: DB, id: number): OtherIncome {
  const row = db.prepare(`${OTHER_INCOME_SELECT} WHERE o.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) throw notFound('No se encontró el otro ingreso.')
  return mapOtherIncomeRow(row)
}

export function listOtherIncome(db: DB, filters: RecordFilters = {}): {
  items: OtherIncome[]
  total: number
  limit: number
  offset: number
} {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)
  const offset = Math.max(filters.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters.from) {
    conditions.push('substr(o.occurred_at, 1, 10) >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    conditions.push('substr(o.occurred_at, 1, 10) <= ?')
    params.push(filters.to)
  }
  if (filters.status === 'active') conditions.push("o.status = 'active'")
  if (filters.status === 'voided') conditions.push("o.status = 'voided'")
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM other_income o ${where}`).get(...params) as {
      count: number
    }
  ).count
  const rows = db
    .prepare(`${OTHER_INCOME_SELECT} ${where} ORDER BY o.occurred_at DESC, o.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapOtherIncomeRow), total, limit, offset }
}

export function createOtherIncome(
  db: DB,
  user: SessionUser,
  input: { amount: number; occurredAt: string; concept: string },
): OtherIncome {
  const transaction = db.transaction(() => {
    const now = nowBogota()
    const result = db
      .prepare(
        `INSERT INTO other_income
          (amount, occurred_at, concept, source_sale_id, status, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, NULL, 'active', ?, ?, ?, ?)`,
      )
      .run(input.amount, input.occurredAt, input.concept.trim(), now, now, user.id, user.id)
    const otherIncome = getOtherIncome(db, Number(result.lastInsertRowid))
    recordAudit(db, {
      userId: user.id,
      action: 'created',
      entityType: 'other_income',
      entityId: otherIncome.id,
      summary: `Registró otro ingreso de ${input.amount} pesos (${input.concept})`,
      after: otherIncome,
    })
    return otherIncome
  })
  return transaction()
}

export function updateOtherIncome(
  db: DB,
  user: SessionUser,
  id: number,
  input: { amount?: number; occurredAt?: string; concept?: string },
): OtherIncome {
  const transaction = db.transaction(() => {
    const before = getOtherIncome(db, id)
    if (before.status === 'voided') throw conflict('Un ingreso anulado no se puede editar.')
    const now = nowBogota()
    db.prepare(
      `UPDATE other_income SET amount = ?, occurred_at = ?, concept = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(
      input.amount ?? before.amount,
      input.occurredAt ?? before.occurredAt,
      input.concept?.trim() || before.concept,
      now,
      user.id,
      id,
    )
    const after = getOtherIncome(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'updated',
      entityType: 'other_income',
      entityId: id,
      summary: `Editó el otro ingreso #${id} (${before.concept})`,
      before,
      after,
    })
    return after
  })
  return transaction()
}

export function voidOtherIncome(db: DB, user: SessionUser, id: number, reason: string | null): OtherIncome {
  const transaction = db.transaction(() => {
    const before = getOtherIncome(db, id)
    if (before.status === 'voided') throw conflict('El ingreso ya está anulado.')
    const now = nowBogota()
    db.prepare(
      `UPDATE other_income
       SET status = 'voided', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).run(now, user.id, reason, now, user.id, id)
    const after = getOtherIncome(db, id)
    recordAudit(db, {
      userId: user.id,
      action: 'voided',
      entityType: 'other_income',
      entityId: id,
      summary: `Anuló el otro ingreso #${id} (${before.concept})`,
      reason,
      before,
      after,
    })
    return after
  })
  return transaction()
}
