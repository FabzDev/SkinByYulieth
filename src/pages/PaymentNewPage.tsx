import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { SaleDetail, SaleSummary } from '../../shared/types'
import type { PaymentMethod } from '../../shared/constants'
import { nowForDateTimeInput, formatDateTime } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { api, buildQuery, errorMessage } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { SaleStatusBadge } from '../components/badges'
import { DateTimeField, FormField, MoneyInput, SearchField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Money,
  PageHeader,
  Spinner,
} from '../components/ui'

export function PaymentNewPage() {
  const [searchParams] = useSearchParams()
  const initialSaleId = Number(searchParams.get('venta') ?? '') || null
  const navigate = useNavigate()
  const toast = useToast()

  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 280)
  const [sales, setSales] = useState<SaleSummary[]>([])
  const [selected, setSelected] = useState<SaleSummary | null>(null)
  const [loadingSales, setLoadingSales] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(Boolean(initialSaleId))
  const [amount, setAmount] = useState(0)
  const [occurredAt, setOccurredAt] = useState(nowForDateTimeInput())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectSale = (sale: SaleSummary | SaleDetail) => {
    setSelected(sale)
    setAmount(sale.balance)
    setError('')
  }

  useEffect(() => {
    if (!initialSaleId) return
    setLoadingInitial(true)
    api
      .get<{ item: SaleDetail }>(`/api/sales/${initialSaleId}`)
      .then((response) => {
        if (response.item.status === 'voided') {
          setError('La venta indicada está anulada y no admite pagos.')
        } else if (response.item.balance <= 0) {
          setError('La venta indicada ya está pagada por completo.')
        } else {
          selectSale(response.item)
        }
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoadingInitial(false))
  }, [initialSaleId])

  useEffect(() => {
    if (selected) return
    let cancelled = false
    setLoadingSales(true)
    api
      .get<{ items: SaleSummary[] }>(
        `/api/sales/open${buildQuery({ q: debouncedQ.trim(), limit: 20 })}`,
      )
      .then((response) => {
        if (!cancelled) setSales(response.items)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoadingSales(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, selected])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) {
      setError('Selecciona la venta que estás cobrando.')
      return
    }
    if (!amount || amount <= 0) {
      setError('Escribe el valor recibido.')
      return
    }
    if (amount > selected.balance) {
      setError(
        `El pago supera el saldo pendiente (${formatCOP(selected.balance)}). Corrige el valor.`,
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await api.post<{ item: SaleDetail }>('/api/payments', {
        saleId: selected.id,
        amount,
        occurredAt,
        method,
      })
      toast.success('Pago registrado. El saldo de la venta quedó actualizado.')
      navigate(`/ventas/${response.item.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="page">
        <PageHeader title="Recibir pago" backTo="/" backLabel="Tablero" />
        <LoadingBlock rows={5} />
      </div>
    )
  }

  return (
    <div className="page page--form">
      <PageHeader
        eyebrow="Pagos"
        title="Recibir pago"
        subtitle="Registra el dinero que realmente entró. Puede ser un pago total o un abono."
        backTo={selected ? `/ventas/${selected.id}` : '/ventas'}
        backLabel={selected ? 'Detalle de la venta' : 'Ventas'}
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      {!selected ? (
        <div className="select-sale-panel">
          <div className="filter-card">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Buscar venta pendiente por servicio o cliente"
              ariaLabel="Buscar venta pendiente"
            />
            <p className="filter-hint">
              Solo aparecen ventas activas con saldo pendiente. Si no encuentras la venta,
              regístrala primero.
            </p>
          </div>

          {loadingSales ? (
            <LoadingBlock rows={4} />
          ) : sales.length ? (
            <div className="select-sale-list">
              {sales.map((sale) => (
                <button key={sale.id} type="button" className="select-sale-card" onClick={() => selectSale(sale)}>
                  <div>
                    <strong>{sale.concept}</strong>
                    <span>
                      {sale.clientName || 'Sin cliente'} · {formatDateTime(sale.occurredAt)}
                    </span>
                  </div>
                  <div className="select-sale-card__right">
                    <span>Saldo</span>
                    <Money value={sale.balance} />
                    <SaleStatusBadge status={sale.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="payment"
              title="No hay ventas pendientes de cobro"
              message="Cuando registres una venta sin pago completo, aparecerá aquí para recibir sus abonos."
              action={
                <Link to="/ventas/nueva" className="button button--primary">
                  <Icon name="plus" size={17} /> Registrar venta
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="form-layout">
          <div className="form-main">
            <div className="selected-sale">
              <div className="selected-sale__top">
                <div>
                  <p className="eyebrow">Venta seleccionada</p>
                  <h2>{selected.concept}</h2>
                  <p>
                    {selected.clientName || 'Sin cliente'} · {formatDateTime(selected.occurredAt)}
                  </p>
                </div>
                <SaleStatusBadge status={selected.status} />
              </div>
              <div className="selected-sale__numbers">
                <span>Total <Money value={selected.total} /></span>
                <span>Recibido <Money value={selected.paid} /></span>
                <span>Saldo <Money value={selected.balance} /></span>
              </div>
              {!searchParams.get('venta') ? (
                <button type="button" className="text-link" onClick={() => setSelected(null)}>
                  <Icon name="chevronLeft" size={15} /> Elegir otra venta
                </button>
              ) : (
                <Link to="/pagos/nuevo" className="text-link">
                  <Icon name="chevronLeft" size={15} /> Elegir otra venta
                </Link>
              )}
            </div>

            <div className="form-section">
              <div className="form-section__heading">
                <h2>Datos del pago</h2>
                <p>El ingreso se reconoce en la fecha y hora que indiques.</p>
              </div>
              <div className="form-section__body">
                <FormField label="Valor recibido" htmlFor="payment-amount" required>
                  <MoneyInput id="payment-amount" value={amount} onChange={setAmount} autoFocus />
                  <button
                    type="button"
                    className="text-link text-link--small"
                    onClick={() => setAmount(selected.balance)}
                  >
                    Usar el saldo completo ({formatCOP(selected.balance)})
                  </button>
                </FormField>
                <div className="form-grid">
                  <FormField label="Fecha y hora del pago" htmlFor="payment-date" required>
                    <DateTimeField id="payment-date" value={occurredAt} onChange={setOccurredAt} />
                  </FormField>
                  <FormField label="Método de pago" htmlFor="payment-method">
                    <div className="method-options">
                      <label className={method === 'cash' ? 'is-selected' : ''}>
                        <input
                          type="radio"
                          name="method"
                          value="cash"
                          checked={method === 'cash'}
                          onChange={() => setMethod('cash')}
                        />
                        <Icon name="money" size={18} />
                        Efectivo
                      </label>
                      <label className={method === 'transfer' ? 'is-selected' : ''}>
                        <input
                          type="radio"
                          name="method"
                          value="transfer"
                          checked={method === 'transfer'}
                          onChange={() => setMethod('transfer')}
                        />
                        <Icon name="payment" size={18} />
                        Transferencia
                      </label>
                    </div>
                  </FormField>
                </div>
                <p className="form-note">
                  <Icon name="info" size={15} />
                  Aunque la venta sea de un mes anterior, este pago aparecerá en los ingresos
                  del período en que se recibió.
                </p>
              </div>
            </div>
          </div>

          <aside className="form-side">
            <div className="summary-card">
              <p className="eyebrow">Resumen del pago</p>
              <Money value={amount} className="summary-card__total" />
              <ul>
                <li>
                  <span>Saldo antes</span>
                  <strong>{formatCOP(selected.balance)}</strong>
                </li>
                <li>
                  <span>Saldo después</span>
                  <strong>{formatCOP(Math.max(selected.balance - amount, 0))}</strong>
                </li>
                <li>
                  <span>Método</span>
                  <strong>{method === 'cash' ? 'Efectivo' : 'Transferencia'}</strong>
                </li>
              </ul>
              <p className="summary-card__note">
                <Icon name="info" size={16} />
                No se puede recibir más que el saldo pendiente de la venta.
              </p>
            </div>
            <div className="form-actions">
              <button type="submit" className="button button--primary button--block button--large" disabled={busy}>
                {busy ? <Spinner /> : <Icon name="check" size={18} />}
                Registrar pago
              </button>
              <Link to={`/ventas/${selected.id}`} className="button button--secondary button--block">
                Cancelar
              </Link>
            </div>
          </aside>
        </form>
      )}
    </div>
  )
}
