import { Link } from 'react-router-dom'
import type { HistoryEntry } from '../../shared/types'
import { HISTORY_KIND_LABELS, SALE_STATUS_LABELS } from '../../shared/constants'
import { formatDateTime } from '../../shared/dates'
import { Icon, type IconName } from './Icon'
import { Money } from './ui'

const kindIcons: Record<HistoryEntry['kind'], IconName> = {
  sale: 'sales',
  payment: 'payment',
  refund: 'refresh',
  expense: 'expenses',
  withdrawal: 'withdrawals',
  other_income: 'otherIncome',
  void: 'ban',
}

const kindTones: Record<HistoryEntry['kind'], string> = {
  sale: 'neutral',
  payment: 'success',
  refund: 'danger',
  expense: 'danger',
  withdrawal: 'warning',
  other_income: 'success',
  void: 'void',
}

function statusLabel(entry: HistoryEntry): string | null {
  if (entry.kind === 'sale') {
    return SALE_STATUS_LABELS[entry.status as keyof typeof SALE_STATUS_LABELS] ?? null
  }
  if (entry.kind === 'payment') return entry.status === 'valid' ? 'Válido' : 'Anulado'
  if (entry.kind === 'refund') return entry.status === 'active' ? 'Activa' : 'Anulada'
  if (entry.kind === 'expense' || entry.kind === 'withdrawal' || entry.kind === 'other_income') {
    return entry.status === 'active' ? 'Activo' : 'Anulado'
  }
  if (entry.kind === 'void') return 'Anulación'
  return null
}

function amountDisplay(entry: HistoryEntry) {
  if (entry.kind === 'void') return <span className="history-item__no-amount">—</span>
  if (entry.kind === 'sale') {
    return (
      <div className="history-item__amount">
        <Money value={entry.amount} />
        <span>venta</span>
      </div>
    )
  }
  return (
    <div className="history-item__amount">
      <Money
        value={entry.amount}
        signed
        tone={entry.amount >= 0 ? 'positive' : 'negative'}
      />
      <span>{entry.amount >= 0 ? 'entrada' : 'salida'}</span>
    </div>
  )
}

export function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const content = (
    <>
      <span className={`history-item__icon history-item__icon--${kindTones[entry.kind]}`}>
        <Icon name={kindIcons[entry.kind]} size={18} />
      </span>
      <div className="history-item__main">
        <div className="history-item__top">
          <span className="history-item__kind">
            {HISTORY_KIND_LABELS[entry.kind]}
            {statusLabel(entry) ? <span className="history-item__status"> · {statusLabel(entry)}</span> : null}
          </span>
          <span className="history-item__date">{formatDateTime(entry.occurredAt)}</span>
        </div>
        <h3>{entry.description}</h3>
        <div className="history-item__bottom">
          <span>{entry.detail || 'Sin detalle'}</span>
          <span>·</span>
          <span>{entry.userName}</span>
          {entry.reason ? <span className="history-item__reason">Motivo: {entry.reason}</span> : null}
        </div>
      </div>
      {amountDisplay(entry)}
      {entry.href ? (
        <span className="history-item__arrow">
          <Icon name="chevronRight" size={17} />
        </span>
      ) : null}
    </>
  )

  return entry.href ? (
    <Link to={entry.href} className="history-item">
      {content}
    </Link>
  ) : (
    <div className="history-item">{content}</div>
  )
}

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return null
  return (
    <div className="history-list">
      {entries.map((entry) => (
        <HistoryItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
