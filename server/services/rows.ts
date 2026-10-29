import type {
  Client,
  Expense,
  ExpenseCategory,
  OtherIncome,
  Payment,
  Refund,
  SaleSummary,
  Service,
  Withdrawal,
} from '../../shared/types'
import type { SaleStatus } from '../../shared/constants'

type Row = Record<string, unknown>

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableStr(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

export function mapSaleRow(row: Row): SaleSummary {
  const total = num(row.total_amount)
  const paid = num(row.paid)
  const voided = str(row.status) === 'voided'
  const balance = voided ? 0 : Math.max(total - paid, 0)
  const status: SaleStatus = voided
    ? 'voided'
    : paid <= 0
      ? 'pending'
      : balance === 0
        ? 'paid'
        : 'partial'

  return {
    id: num(row.id),
    serviceId: row.service_id == null ? null : num(row.service_id),
    concept: str(row.concept),
    clientId: row.client_id == null ? null : num(row.client_id),
    clientName: nullableStr(row.client_name),
    total,
    paid,
    refunded: num(row.refunded),
    balance,
    status,
    occurredAt: str(row.occurred_at),
    description: nullableStr(row.description),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name),
    updatedByName: str(row.updated_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
    paymentsCount: num(row.payments_count),
    lastPaymentAt: nullableStr(row.last_payment_at),
  }
}

export function mapPaymentRow(row: Row): Payment {
  return {
    id: num(row.id),
    saleId: num(row.sale_id),
    saleConcept: row.sale_concept == null ? undefined : str(row.sale_concept),
    amount: num(row.amount),
    occurredAt: str(row.occurred_at),
    method: str(row.method) as Payment['method'],
    status: str(row.status) as Payment['status'],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name),
    updatedByName: str(row.updated_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
    refunded: num(row.refunded),
  }
}

export function mapRefundRow(row: Row): Refund {
  return {
    id: num(row.id),
    saleId: num(row.sale_id),
    paymentId: num(row.payment_id),
    amount: num(row.amount),
    occurredAt: str(row.occurred_at),
    method: str(row.method) as Refund['method'],
    reason: nullableStr(row.reason),
    status: str(row.status) as Refund['status'],
    createdAt: str(row.created_at),
    createdBy: num(row.created_by),
    createdByName: str(row.created_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
  }
}

export function mapServiceRow(row: Row): Service {
  return {
    id: num(row.id),
    name: str(row.name),
    defaultPrice: num(row.default_price),
    active: num(row.active) === 1,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name ?? ''),
    updatedByName: str(row.updated_by_name ?? ''),
  }
}

export function mapCategoryRow(row: Row): ExpenseCategory {
  return {
    id: num(row.id),
    name: str(row.name),
    active: num(row.active) === 1,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: row.created_by == null ? null : num(row.created_by),
    updatedBy: row.updated_by == null ? null : num(row.updated_by),
  }
}

export function mapClientRow(row: Row): Client {
  return {
    id: num(row.id),
    name: str(row.name),
    phone: nullableStr(row.phone),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name ?? ''),
    updatedByName: str(row.updated_by_name ?? ''),
    pendingBalance: num(row.pending_balance),
    salesCount: num(row.sales_count),
  }
}

export function mapExpenseRow(row: Row): Expense {
  const hasReceipt = row.receipt_size != null
  return {
    id: num(row.id),
    amount: num(row.amount),
    categoryId: num(row.category_id),
    categoryName: str(row.category_name),
    occurredAt: str(row.occurred_at),
    description: nullableStr(row.description),
    receipt: hasReceipt
      ? {
          filename: str(row.receipt_filename),
          mimeType: str(row.receipt_mime),
          size: num(row.receipt_size),
        }
      : null,
    status: str(row.status) as Expense['status'],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name),
    updatedByName: str(row.updated_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
  }
}

export function mapWithdrawalRow(row: Row): Withdrawal {
  return {
    id: num(row.id),
    amount: num(row.amount),
    occurredAt: str(row.occurred_at),
    description: nullableStr(row.description),
    status: str(row.status) as Withdrawal['status'],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name),
    updatedByName: str(row.updated_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
  }
}

export function mapOtherIncomeRow(row: Row): OtherIncome {
  return {
    id: num(row.id),
    amount: num(row.amount),
    occurredAt: str(row.occurred_at),
    concept: str(row.concept),
    status: str(row.status) as OtherIncome['status'],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    createdBy: num(row.created_by),
    updatedBy: num(row.updated_by),
    createdByName: str(row.created_by_name),
    updatedByName: str(row.updated_by_name),
    voidedAt: nullableStr(row.voided_at),
    voidedBy: row.voided_by == null ? null : num(row.voided_by),
    voidedByName: nullableStr(row.voided_by_name),
    voidReason: nullableStr(row.void_reason),
    sourceSaleId: row.source_sale_id == null ? null : num(row.source_sale_id),
  }
}
