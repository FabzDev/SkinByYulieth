import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OtherIncome } from '../../shared/types'
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

export function OtherIncomePage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState<OtherIncome[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ items: OtherIncome[]; total: number }>(
        `/api/other-income${buildQuery({
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
        eyebrow="Ingresos del negocio"
        title="Otros ingresos"
        subtitle="Dinero recibido que no viene de una venta: venta de productos, servicios externos o dinero retenido de una venta anulada."
        actions={
          <Link to="/otros-ingresos/nuevo" className="button button--primary">
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            Registrar ingreso
          </Link>
        }
      />

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
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'ingreso' : 'ingresos'} en el período`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={4} />
      ) : items.length ? (
        <>
          <div className="record-list">
            {items.map((income) => (
              <Link
                key={income.id}
                to={`/otros-ingresos/${income.id}`}
                className={`record-row ${income.status === 'voided' ? 'is-voided' : ''}`}
              >
                <span className="record-row__date">
                  <span>{datePart(income.occurredAt).slice(8, 10)}</span>
                  <small>{formatShortDate(income.occurredAt).split(' ').slice(1, 2)}</small>
                </span>
                <span className="record-row__icon record-row__icon--income">
                  <Icon name="otherIncome" size={18} />
                </span>
                <span className="record-row__main">
                  <span className="record-row__title">
                    <strong>{income.concept}</strong>
                    <RecordStatusBadge status={income.status} />
                  </span>
                  <small>
                    {formatDateTime(income.occurredAt)} · {income.createdByName}
                    {income.sourceSaleId ? ` · Venta anulada #${income.sourceSaleId}` : ''}
                  </small>
                </span>
                <span className="record-row__amount">
                  <Money value={income.amount} tone="positive" />
                  <small>ingreso</small>
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
                Cargar más ingresos
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="otherIncome"
          title="No hay otros ingresos con estos filtros"
          message="Registra aquí el dinero que entró por fuera de las ventas de servicios."
          action={
            <Link to="/otros-ingresos/nuevo" className="button button--primary">
              <Icon name="plus" size={17} /> Registrar ingreso
            </Link>
          }
        />
      )}
    </div>
  )
}
