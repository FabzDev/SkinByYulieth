import type {
  HistoryFlow,
  HistoryKind,
  PaymentMethod,
  SaleStatus,
} from './constants'

export interface SessionUser {
  id: number
  name: string
  email: string
}

export interface Service {
  id: number
  name: string
  defaultPrice: number
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
}

export interface ExpenseCategory {
  id: number
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy: number | null
  updatedBy: number | null
}

export interface Client {
  id: number
  name: string
  phone: string | null
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  pendingBalance?: number
  salesCount?: number
}

export interface ClientDetail {
  client: Client
  sales: SaleSummary[]
  payments: Payment[]
}

export interface SaleSummary {
  id: number
  serviceId: number | null
  concept: string
  clientId: number | null
  clientName: string | null
  total: number
  paid: number
  refunded: number
  balance: number
  status: SaleStatus
  occurredAt: string
  description: string | null
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
  paymentsCount?: number
  lastPaymentAt?: string | null
}

export interface Payment {
  id: number
  saleId: number
  saleConcept?: string
  amount: number
  occurredAt: string
  method: PaymentMethod
  status: 'valid' | 'voided'
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
  refunded: number
}

export interface Refund {
  id: number
  saleId: number
  paymentId: number
  amount: number
  occurredAt: string
  method: PaymentMethod
  reason: string | null
  status: 'active' | 'voided'
  createdAt: string
  createdBy: number
  createdByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
}

export interface SaleDetail extends SaleSummary {
  payments: Payment[]
  refunds: Refund[]
}

export interface Expense {
  id: number
  amount: number
  categoryId: number
  categoryName: string
  occurredAt: string
  description: string | null
  receipt: {
    filename: string
    mimeType: string
    size: number
  } | null
  status: 'active' | 'voided'
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
}

export interface Withdrawal {
  id: number
  amount: number
  occurredAt: string
  description: string | null
  status: 'active' | 'voided'
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
}

export interface OtherIncome {
  id: number
  amount: number
  occurredAt: string
  concept: string
  status: 'active' | 'voided'
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  createdByName: string
  updatedByName: string
  voidedAt: string | null
  voidedBy: number | null
  voidedByName: string | null
  voidReason: string | null
  sourceSaleId: number | null
}

export interface DashboardData {
  from: string
  to: string
  received: {
    payments: number
    otherIncome: number
    refunds: number
    total: number
  }
  expenses: number
  estimatedProfit: number
  withdrawals: number
  pending: {
    total: number
    salesCount: number
  }
  salesTotal: number
  salesCount: number
  pendingSalesCount: number
  partialSalesCount: number
}

export interface HistoryEntry {
  id: string
  kind: HistoryKind
  flow: HistoryFlow
  occurredAt: string
  createdAt: string
  amount: number
  description: string
  detail: string | null
  status: string
  entityId: number
  saleId: number | null
  userName: string
  reason: string | null
  href: string | null
}

export interface HistoryResponse {
  entries: HistoryEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditEntry {
  id: number
  action: string
  entityType: string
  entityId: number
  summary: string
  reason: string | null
  before: unknown
  after: unknown
  createdAt: string
  userName: string
  userId: number
}

export interface BackupInfo {
  filename: string
  size: number
  createdAt: string
}

export interface BackupsResponse {
  backups: BackupInfo[]
  lastBackupAt: string | null
  directory: string
}

export interface ApiErrorBody {
  error: string
  code?: string
  details?: Record<string, string>
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
