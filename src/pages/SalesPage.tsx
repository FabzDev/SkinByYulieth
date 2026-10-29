import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SaleSummary } from '../../shared/types'
import { currentMonthRange, datePart, formatShortDate, formatDateTime } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Icon } from '../components/Icon'
import { SaleStatusBadge } from '../components/badges'
import { DateField, SearchField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Money,
  PageHeader,
} from '../components/ui'

export function SalesPage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const [limit, setLimit] = useState(100)
  const [items, setItems] = useState<SaleSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get<{ items: SaleSummary[]; total: number }>(
        `/api/sales${buildQuery({
          from: range.from,
          to: range.to,
          status,
          q: debouncedQ.trim(),
          limit,
        })}`,
      )
      .then((response) => {
        if (cancelled) return
        setItems(response.items)
        setTotal(response.total)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, status, debouncedQ, limit])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Movimientos"
        title="Ventas"
        subtitle="Valor de los servicios realizados. Una venta no es dinero recibido hasta que registras su pago."
        actions={
          <Link to="/ventas/nueva" className="button button--primary">
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            Nueva venta
          </Link>
        }
      />

      <div className="filter-card">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Buscar por servicio, cliente o descripción"
          ariaLabel="Buscar ventas"
        />
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
              <option value="all">Todas</option>
              <option value="pending">Pendientes</option>
              <option value="partial">Parciales</option>
              <option value="paid">Pagadas</option>
              <option value="open">Con saldo</option>
              <option value="voided">Anuladas</option>
            </select>
          </div>
          <button
            type="button"
            className="button button--ghost button--small filter-clear"
            onClick={() => {
              setRange(currentMonthRange())
              setStatus('all')
              setQ('')
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="list-summary">
        <span>
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'venta' : 'ventas'} en el período`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={5} />
      ) : items.length ? (
        <>
          <div className="sale-list">
            {items.map((sale) => (
              <Link key={sale.id} to={`/ventas/${sale.id}`} className={`sale-card ${sale.status === 'voided' ? 'is-voided' : ''}`}>
                <div className="sale-card__date">
                  <span>{datePart(sale.occurredAt).slice(8, 10)}</span>
                  <small>{formatShortDate(sale.occurredAt).split(' ').slice(1, 2)}</small>
                </div>
                <div className="sale-card__main">
                  <div className="sale-card__title-row">
                    <h3>{sale.concept}</h3>
                    <SaleStatusBadge status={sale.status} />
                  </div>
                  <p>
                    {sale.clientName || 'Sin cliente'} · {formatDateTime(sale.occurredAt)}
                  </p>
                  <div className="sale-card__numbers">
                    <span>Total <strong><Money value={sale.total} /></strong></span>
                    <span>Recibido <strong><Money value={sale.paid} /></strong></span>
                    {sale.status !== 'voided' ? (
                      <span>Saldo <strong><Money value={sale.balance} /></strong></span>
                    ) : null}
                  </div>
                </div>
                <span className="sale-card__arrow">
                  <Icon name="chevronRight" size={18} />
                </span>
              </Link>
            ))}
          </div>
          {total > items.length ? (
            <div className="load-more">
              <button type="button" className="button button--secondary" onClick={() => setLimit((value) => value + 100)}>
                Cargar más ventas
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="sales"
          title="No hay ventas con estos filtros"
          message="Registra una venta aunque todavía no hayas recibido el dinero."
          action={
            <Link to="/ventas/nueva" className="button button--primary">
              <Icon name="plus" size={17} /> Registrar venta
            </Link>
          }
        />
      )}
    </div>
  )
}
