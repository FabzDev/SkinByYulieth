import { useCallback, useEffect, useState } from 'react'
import type { HistoryResponse } from '../../shared/types'
import {
  HISTORY_FLOW_LABELS,
  HISTORY_KIND_LABELS,
  type HistoryFlow,
  type HistoryKind,
} from '../../shared/constants'
import { currentMonthRange } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { DateField, SearchField } from '../components/forms'
import { HistoryList } from '../components/HistoryList'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

const kindOptions: Array<{ value: 'all' | HistoryKind; label: string }> = [
  { value: 'all', label: 'Todos los tipos' },
  ...(Object.keys(HISTORY_KIND_LABELS) as HistoryKind[]).map((kind) => ({
    value: kind,
    label: HISTORY_KIND_LABELS[kind],
  })),
]

const flowOptions: Array<{ value: 'all' | HistoryFlow; label: string }> = [
  { value: 'all', label: 'Todos los movimientos' },
  ...(Object.keys(HISTORY_FLOW_LABELS) as HistoryFlow[]).map((flow) => ({
    value: flow,
    label: HISTORY_FLOW_LABELS[flow],
  })),
]

export function HistoryPage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [kind, setKind] = useState<'all' | HistoryKind>('all')
  const [flow, setFlow] = useState<'all' | HistoryFlow>('all')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const [limit, setLimit] = useState(100)
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<HistoryResponse>(
        `/api/history${buildQuery({
          from: range.from,
          to: range.to,
          kind,
          flow,
          q: debouncedQ.trim() || undefined,
          limit,
        })}`,
      )
      setData(response)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to, kind, flow, debouncedQ, limit])

  useEffect(() => {
    void load()
  }, [load])

  const entries = data?.entries ?? []

  return (
    <div className="page">
      <PageHeader
        eyebrow="Todo en orden"
        title="Historial"
        subtitle="Ventas, pagos, devoluciones, gastos, retiros, otros ingresos y anulaciones en una sola línea de tiempo."
      />

      <div className="filter-card">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Buscar por concepto, cliente o usuario"
          ariaLabel="Buscar en el historial"
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
            <span>Tipo</span>
            <select
              className="select"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'all' | HistoryKind)}
            >
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <span>Flujo</span>
            <select
              className="select"
              value={flow}
              onChange={(event) => setFlow(event.target.value as 'all' | HistoryFlow)}
            >
              {flowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button button--ghost button--small filter-clear"
            onClick={() => {
              setRange(currentMonthRange())
              setKind('all')
              setFlow('all')
              setQ('')
            }}
          >
            Limpiar
          </button>
        </div>
        <p className="filter-hint">
          Las ventas aparecen por su valor, aunque no se hayan cobrado. Los pagos y otros ingresos
          aparecen como entradas; gastos, retiros y devoluciones como salidas.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="list-summary">
        <span>
          {loading
            ? 'Buscando…'
            : `${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? 'movimiento' : 'movimientos'}`}
        </span>
        {data && data.total > entries.length && !loading ? (
          <span>Mostrando {entries.length}</span>
        ) : null}
      </div>

      {loading && !entries.length ? (
        <LoadingBlock rows={6} />
      ) : entries.length ? (
        <>
          <HistoryList entries={entries} />
          {data && data.total > entries.length ? (
            <div className="load-more">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setLimit((value) => value + 100)}
              >
                Cargar más movimientos
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="history"
          title="No hay movimientos con estos filtros"
          message="Prueba con otro período o quita los filtros para ver todo el historial."
          action={
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setRange(currentMonthRange())
                setKind('all')
                setFlow('all')
                setQ('')
              }}
            >
              Ver el mes actual completo
            </button>
          }
        />
      )}
    </div>
  )
}
