import { useCallback, useEffect, useState } from 'react'
import type { AuditEntry } from '../../shared/types'
import {
  AUDIT_ACTION_LABELS,
  ENTITY_TYPE_LABELS,
} from '../../shared/constants'
import { currentMonthRange, formatDateTime } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { Icon } from '../components/Icon'
import { DateField, SearchField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'

interface AuditUser {
  id: number
  name: string
}

export function AuditPage() {
  const [range, setRange] = useState(() => currentMonthRange())
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)
  const [limit, setLimit] = useState(100)
  const [users, setUsers] = useState<AuditUser[]>([])
  const [items, setItems] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .get<{ items: AuditUser[] }>('/api/audit/users')
      .then((response) => setUsers(response.items))
      .catch(() => setUsers([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ items: AuditEntry[]; total: number }>(
        `/api/audit${buildQuery({
          from: range.from,
          to: range.to,
          entityType: entityType || undefined,
          action: action || undefined,
          userId: userId || undefined,
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
  }, [range.from, range.to, entityType, action, userId, debouncedQ, limit])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page">
      <PageHeader
        eyebrow="Trazabilidad"
        title="Auditoría"
        subtitle="Quién creó, editó o anuló cada registro, con fecha y hora de Colombia. Nada se elimina de este registro."
      />

      <div className="filter-card">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Buscar por resumen o motivo"
          ariaLabel="Buscar en auditoría"
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
            <span>Registro</span>
            <select className="select" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(ENTITY_TYPE_LABELS) as string[]).map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <span>Acción</span>
            <select className="select" value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(AUDIT_ACTION_LABELS) as string[]).map((value) => (
                <option key={value} value={value}>
                  {AUDIT_ACTION_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <span>Usuario</span>
            <select className="select" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button button--ghost button--small filter-clear"
            onClick={() => {
              setRange(currentMonthRange())
              setEntityType('')
              setAction('')
              setUserId('')
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
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'registro' : 'registros'} de auditoría`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={6} />
      ) : items.length ? (
        <>
          <div className="audit-list">
            {items.map((entry) => (
              <details key={entry.id} className="audit-item">
                <summary className="audit-item__summary">
                  <span className="audit-item__icon">
                    <Icon name="audit" size={18} />
                  </span>
                  <span className="audit-item__main">
                    <span className="audit-item__title">
                      <strong>{entry.summary}</strong>
                      <span className="badge badge--outline">
                        {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </span>
                    <span className="audit-item__meta">
                      {ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType} #{entry.entityId} ·{' '}
                      {entry.userName} · {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.reason ? (
                      <span className="audit-item__reason">Motivo: {entry.reason}</span>
                    ) : null}
                  </span>
                  <span className="audit-item__chevron">
                    <Icon name="chevronDown" size={17} />
                  </span>
                </summary>
                <div className="audit-item__body">
                  <div>
                    <p className="audit-item__label">Antes</p>
                    <pre>{entry.before ? JSON.stringify(entry.before, null, 2) : 'Sin datos anteriores.'}</pre>
                  </div>
                  <div>
                    <p className="audit-item__label">Después</p>
                    <pre>{entry.after ? JSON.stringify(entry.after, null, 2) : 'Sin datos posteriores.'}</pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
          {total > items.length ? (
            <div className="load-more">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setLimit((value) => value + 100)}
              >
                Cargar más registros
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="audit"
          title="No hay registros de auditoría con estos filtros"
          message="Cada creación, edición y anulación aparece aquí automáticamente."
        />
      )}
    </div>
  )
}
