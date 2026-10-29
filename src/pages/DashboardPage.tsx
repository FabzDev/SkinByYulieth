import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardData, HistoryResponse, HistoryEntry } from '../../shared/types'
import { currentMonthRange, monthLabel, periodLabel, todayBogota } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { PeriodPicker } from '../components/PeriodPicker'
import { HistoryList } from '../components/HistoryList'
import { EmptyState, ErrorBanner, LoadingBlock, Money } from '../components/ui'

const quickActions = [
  { to: '/ventas/nueva', label: 'Registrar venta', detail: 'Servicio o concepto libre', icon: 'sales' as const },
  { to: '/pagos/nuevo', label: 'Recibir pago', detail: 'Abono o pago total', icon: 'payment' as const },
  { to: '/gastos/nuevo', label: 'Registrar gasto', detail: 'Productos, arriendo, equipos', icon: 'expenses' as const },
  { to: '/retiros/nuevo', label: 'Registrar retiro', detail: 'Dinero para uso personal', icon: 'withdrawals' as const },
]

function MetricCard({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
  children,
  featured = false,
}: {
  label: string
  value: number
  icon: Parameters<typeof Icon>[0]['name']
  hint?: string
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
  children?: ReactNode
  featured?: boolean
}) {
  return (
    <article className={`metric-card metric-card--${tone} ${featured ? 'metric-card--featured' : ''}`}>
      <div className="metric-card__head">
        <span className="metric-card__icon">
          <Icon name={icon} size={18} />
        </span>
        <span>{label}</span>
      </div>
      <Money value={value} className="metric-card__value" />
      {hint ? <p className="metric-card__hint">{hint}</p> : null}
      {children}
    </article>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState(() => currentMonthRange())
  const [data, setData] = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setHistoryLoading(true)
    setError('')
    try {
      const params = buildQuery({ from: range.from, to: range.to })
      const [dashboard, recent] = await Promise.all([
        api.get<DashboardData>(`/api/dashboard${params}`),
        api.get<HistoryResponse>(`/api/history${params}&limit=7`),
      ])
      setData(dashboard)
      setHistory(recent.entries)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
      setHistoryLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const firstName = user?.name.split(' ')[0] ?? ''
  const today = todayBogota()
  const isCurrentMonth =
    range.from === currentMonthRange().from && range.to === currentMonthRange().to
  const periodName = isCurrentMonth ? monthLabel(today.slice(0, 7)) : periodLabel(range.from, range.to)

  return (
    <div className="page dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Tablero</p>
          <h1>Hola, {firstName}</h1>
          <p className="dashboard-hero__subtitle">
            Así va <strong>{periodName}</strong>. Todo calculado desde tus movimientos.
          </p>
        </div>
        <PeriodPicker
          from={range.from}
          to={range.to}
          onChange={(from, to) => setRange({ from, to })}
        />
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : null}

      {loading && !data ? (
        <LoadingBlock rows={7} label="Calculando el tablero…" />
      ) : data ? (
        <>
          <section className="section-block" aria-labelledby="resumen-title">
            <div className="section-heading">
              <div>
                <h2 id="resumen-title">Resumen del período</h2>
                <p>Los indicadores se calculan con las fechas reales de cada movimiento.</p>
              </div>
              <Link to="/historial" className="text-link">
                Ver historial <Icon name="arrowUpRight" size={15} />
              </Link>
            </div>

            <div className="metrics-grid">
              <MetricCard
                label="Ingresos recibidos"
                value={data.received.total}
                icon="arrowDownLeft"
                tone="positive"
                featured
                hint="Dinero efectivamente cobrado, no el valor vendido."
              >
                <div className="metric-card__breakdown">
                  <span>Pagos <strong><Money value={data.received.payments} /></strong></span>
                  <span>Otros ingresos <strong><Money value={data.received.otherIncome} /></strong></span>
                  {data.received.refunds > 0 ? (
                    <span>Devoluciones <strong><Money value={-data.received.refunds} /></strong></span>
                  ) : null}
                </div>
              </MetricCard>

              <MetricCard
                label="Gastos pagados"
                value={data.expenses}
                icon="arrowUpRight"
                tone="negative"
                hint="Gastos del negocio pagados en el período."
              />

              <MetricCard
                label="Ganancia estimada"
                value={data.estimatedProfit}
                icon="sparkle"
                tone={data.estimatedProfit < 0 ? 'negative' : 'accent'}
                hint="Ingresos recibidos menos gastos pagados. No es una utilidad contable formal."
              />

              <MetricCard
                label="Retiros personales"
                value={data.withdrawals}
                icon="withdrawals"
                tone="neutral"
                hint="No son gastos del negocio ni reducen la ganancia estimada."
              />

              <MetricCard
                label="Pendiente de cobrar"
                value={data.pending.total}
                icon="history"
                tone={data.pending.total > 0 ? 'neutral' : 'positive'}
                hint={`Saldo actual de ${data.pending.salesCount} ${
                  data.pending.salesCount === 1 ? 'venta activa' : 'ventas activas'
                }. No pertenece solo a este período.`}
              />
            </div>

            <div className="sales-strip">
              <div>
                <span className="sales-strip__icon"><Icon name="sales" size={18} /></span>
                <div>
                  <p>Ventas realizadas en el período</p>
                  <small>
                    {data.salesCount} {data.salesCount === 1 ? 'venta' : 'ventas'} · valor registrado, no dinero recibido
                  </small>
                </div>
              </div>
              <Money value={data.salesTotal} className="sales-strip__amount" />
            </div>
          </section>

          <section className="section-block" aria-labelledby="acciones-title">
            <div className="section-heading">
              <div>
                <h2 id="acciones-title">Acciones rápidas</h2>
                <p>Registra lo que acaba de pasar, sin cálculos manuales.</p>
              </div>
            </div>
            <div className="quick-grid">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to} className="quick-card">
                  <span className="quick-card__icon">
                    <Icon name={action.icon} size={21} />
                  </span>
                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.detail}</small>
                  </span>
                  <Icon name="chevronRight" size={17} className="quick-card__arrow" />
                </Link>
              ))}
            </div>
          </section>

          <section className="section-block" aria-labelledby="recientes-title">
            <div className="section-heading">
              <div>
                <h2 id="recientes-title">Movimientos recientes</h2>
                <p>Ventas, pagos, gastos, retiros y otros ingresos del período.</p>
              </div>
              <Link to="/historial" className="text-link">
                Todo el historial <Icon name="chevronRight" size={15} />
              </Link>
            </div>
            {historyLoading ? (
              <LoadingBlock rows={4} />
            ) : history.length ? (
              <HistoryList entries={history} />
            ) : (
              <EmptyState
                icon="sparkle"
                title="Todavía no hay movimientos en este período"
                message="Empieza registrando una venta, un gasto o un pago recibido."
                action={
                  <Link to="/ventas/nueva" className="button button--primary">
                    <Icon name="plus" size={17} /> Registrar primera venta
                  </Link>
                }
              />
            )}
          </section>

          <p className="dashboard-footnote">
            <Icon name="info" size={15} />
            La ganancia estimada es un indicador simplificado de caja. No incluye impuestos,
            depreciación ni saldos de cuentas bancarias.
          </p>
        </>
      ) : null}
    </div>
  )
}
