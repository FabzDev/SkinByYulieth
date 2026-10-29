import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Withdrawal } from '../../shared/types'
import { currentMonthRange, datePart, formatShortDate, formatDateTime } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { Icon } from '../components/Icon'
import { RecordStatusBadge } from '../components/badges'
import { DateField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Money,
  PageHeader,
} from '../components/ui'

export function WithdrawalsPage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState<Withdrawal[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ items: Withdrawal[]; total: number }>(
        `/api/withdrawals${buildQuery({
          from: range.from,
          to: range.to,
          status,
          limit,
        })}`,
      )
      setItems(response.items)
      setTotal(response.total)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, status, limit])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Dinero personal"
        title="Retiros"
        subtitle="Dinero del negocio que sacaste para uso personal. No es un gasto del negocio y no reduce la ganancia estimada."
        actions={
          <Link to="/retiros/nuevo" className="button button--primary">
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            Registrar retiro
          </Link>
        }
      />

      <div className="inline-note">
        <Icon name="info" size={17} />
        <span>
          La ganancia estimada mide el resultado del negocio. Los retiros muestran cuánto de ese
          dinero ya salió hacia tu uso personal.
        </span>
      </div>

      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-field">
            <span>Desde</span>
            <DateField value={range.from} max={range.to} onChange={(value) => setRange((r) => ({ ...r, from: value }))} />
          </div>
          <div className="filter-field">
            <span>Hasta</span>
            <DateField value={range.to} min={range.from} onChange={(value) => setRange((r) => ({ ...r, to: value }))} />
          </div>
          <div className="filter-field">
            <span>Estado</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="voided">Anulados</option>
            </select>
          </div>
          <button
            type="button"
            className="button button--ghost button--small filter-clear"
            onClick={() => {
              setRange(currentMonthRange())
              setStatus('all')
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="list-summary">
        <span>
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'retiro' : 'retiros'} en el período`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={4} />
      ) : items.length ? (
        <>
          <div className="record-list">
            {items.map((withdrawal) => (
              <Link
                key={withdrawal.id}
                to={`/retiros/${withdrawal.id}`}
                className={`record-row ${withdrawal.status === 'voided' ? 'is-voided' : ''}`}
              >
                <span className="record-row__date">
                  <span>{datePart(withdrawal.occurredAt).slice(8, 10)}</span>
                  <small>{formatShortDate(withdrawal.occurredAt).split(' ').slice(1, 2)}</small>
                </span>
                <span className="record-row__icon record-row__icon--withdrawal">
                  <Icon name="withdrawals" size={18} />
                </span>
                <span className="record-row__main">
                  <span className="record-row__title">
                    <strong>{withdrawal.description || 'Retiro personal'}</strong>
                    <RecordStatusBadge status={withdrawal.status} />
                  </span>
                  <small>
                    {formatDateTime(withdrawal.occurredAt)} · {withdrawal.createdByName}
                  </small>
                </span>
                <span className="record-row__amount">
                  <Money value={withdrawal.amount} />
                  <small>retiro</small>
                </span>
                <span className="record-row__arrow">
                  <Icon name="chevronRight" size={17} />
                </span>
              </Link>
            ))}
          </div>
          {total > items.length ? (
            <div className="load-more">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setLimit((value) => value + 100)}
              >
                Cargar más retiros
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="withdrawals"
          title="No hay retiros con estos filtros"
          message="Cuando saques dinero del negocio para ti, regístralo aquí para no confundirlo con un gasto."
          action={
            <Link to="/retiros/nuevo" className="button button--primary">
              <Icon name="plus" size={17} /> Registrar retiro
            </Link>
          }
        />
      )}
    </div>
  )
}
