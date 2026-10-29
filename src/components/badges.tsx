import {
  HISTORY_FLOW_LABELS,
  HISTORY_KIND_LABELS,
  PAYMENT_METHODS,
  RECORD_STATUS_LABELS,
  SALE_STATUS_LABELS,
  type HistoryKind,
  type SaleStatus,
} from '../../shared/constants'

const saleVariants: Record<SaleStatus, string> = {
  pending: 'warning',
  partial: 'info',
  paid: 'success',
  voided: 'neutral',
}

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return (
    <span className={`badge badge--${saleVariants[status]}`}>
      <span className="badge__dot" />
      {SALE_STATUS_LABELS[status]}
    </span>
  )
}

export function RecordStatusBadge({ status }: { status: 'active' | 'voided' }) {
  return (
    <span className={`badge badge--${status === 'active' ? 'success' : 'neutral'}`}>
      {status === 'active' ? RECORD_STATUS_LABELS.active : RECORD_STATUS_LABELS.voided}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: 'valid' | 'voided' }) {
  return (
    <span className={`badge badge--${status === 'valid' ? 'success' : 'neutral'}`}>
      {status === 'valid' ? 'Válido' : 'Anulado'}
    </span>
  )
}

export function MethodLabel({ method }: { method: string }) {
  return (
    <span className="method-label">
      {PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method}
    </span>
  )
}

export function HistoryKindBadge({ kind }: { kind: HistoryKind }) {
  return <span className="badge badge--outline">{HISTORY_KIND_LABELS[kind]}</span>
}

export function HistoryFlowLabel({ flow }: { flow: keyof typeof HISTORY_FLOW_LABELS }) {
  return <span className="muted-small">{HISTORY_FLOW_LABELS[flow]}</span>
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge badge--${active ? 'success' : 'neutral'}`}>
      {active ? 'Activo' : 'Inactivo'}
    </span>
  )
}
