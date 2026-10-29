export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Productos y suministros',
  'Arriendo y servicios públicos',
  'Equipos y muebles',
  'Otros gastos',
] as const

export const SALE_STATUS_LABELS = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
  voided: 'Anulada',
} as const

export type SaleStatus = keyof typeof SALE_STATUS_LABELS

export const RECORD_STATUS_LABELS = {
  active: 'Activo',
  voided: 'Anulado',
} as const

export const HISTORY_KIND_LABELS = {
  sale: 'Venta',
  payment: 'Pago',
  refund: 'Devolución',
  expense: 'Gasto',
  withdrawal: 'Retiro personal',
  other_income: 'Otro ingreso',
  void: 'Anulación',
} as const

export type HistoryKind = keyof typeof HISTORY_KIND_LABELS

export const HISTORY_FLOW_LABELS = {
  sale: 'Venta realizada',
  income: 'Ingreso',
  outflow: 'Salida',
  void: 'Anulación',
} as const

export type HistoryFlow = keyof typeof HISTORY_FLOW_LABELS

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Creación',
  updated: 'Edición',
  voided: 'Anulación',
  payment_created: 'Pago registrado',
  payment_updated: 'Pago editado',
  payment_voided: 'Pago anulado',
  refund_created: 'Devolución registrada',
  refund_voided: 'Devolución anulada',
  login: 'Inicio de sesión',
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  sale: 'Venta',
  payment: 'Pago',
  refund: 'Devolución',
  expense: 'Gasto',
  withdrawal: 'Retiro personal',
  other_income: 'Otro ingreso',
  service: 'Servicio',
  client: 'Cliente',
  expense_category: 'Categoría de gasto',
  user: 'Usuario',
  session: 'Sesión',
}

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const ALLOWED_RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value
}
