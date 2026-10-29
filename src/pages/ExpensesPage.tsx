import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Expense, ExpenseCategory } from '../../shared/types'
import { currentMonthRange, datePart, formatShortDate, formatDateTime } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Icon } from '../components/Icon'
import { RecordStatusBadge } from '../components/badges'
import { DateField, SearchField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Money,
  PageHeader,
} from '../components/ui'

export function ExpensesPage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 280)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [items, setItems] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .get<{ items: ExpenseCategory[] }>('/api/expense-categories?includeInactive=1')
      .then((response) => setCategories(response.items))
      .catch(() => setCategories([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ items: Expense[]; total: number }>(
        `/api/expenses${buildQuery({
          from: range.from,
          to: range.to,
          status,
          categoryId: categoryId || undefined,
          q: debouncedQ.trim() || undefined,
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
  }, [range.from, range.to, status, categoryId, debouncedQ, limit])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Salidas del negocio"
        title="Gastos"
        subtitle="Dinero que pagaste por productos, servicios, equipos u otros gastos del negocio."
        actions={
          <Link to="/gastos/nuevo" className="button button--primary">
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            Registrar gasto
          </Link>
        }
      />

      <div className="filter-card">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Buscar por descripción o categoría"
          ariaLabel="Buscar gastos"
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
            <span>Categoría</span>
            <select className="select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.active ? '' : ' (inactiva)'}
                </option>
              ))}
            </select>
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
              setCategoryId('')
              setQ('')
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="list-summary">
        <span>
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'gasto' : 'gastos'} en el período`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={5} />
      ) : items.length ? (
        <>
          <div className="record-list">
            {items.map((expense) => (
              <Link
                key={expense.id}
                to={`/gastos/${expense.id}`}
                className={`record-row ${expense.status === 'voided' ? 'is-voided' : ''}`}
              >
                <span className="record-row__date">
                  <span>{datePart(expense.occurredAt).slice(8, 10)}</span>
                  <small>{formatShortDate(expense.occurredAt).split(' ').slice(1, 2)}</small>
                </span>
                <span className="record-row__icon record-row__icon--expense">
                  <Icon name="expenses" size={18} />
                </span>
                <span className="record-row__main">
                  <span className="record-row__title">
                    <strong>{expense.description || expense.categoryName}</strong>
                    <RecordStatusBadge status={expense.status} />
                  </span>
                  <small>
                    {expense.categoryName} · {formatDateTime(expense.occurredAt)} ·{' '}
                    {expense.createdByName}
                  </small>
                  {expense.receipt ? (
                    <span className="record-row__tag">
                      <Icon name="file" size={13} /> Comprobante adjunto
                    </span>
                  ) : null}
                </span>
                <span className="record-row__amount">
                  <Money value={expense.amount} tone="negative" />
                  <small>gasto</small>
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
                Cargar más gastos
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="expenses"
          title="No hay gastos con estos filtros"
          message="Registra los pagos del negocio para que la ganancia estimada sea real."
          action={
            <Link to="/gastos/nuevo" className="button button--primary">
              <Icon name="plus" size={17} /> Registrar gasto
            </Link>
          }
        />
      )}
    </div>
  )
}
