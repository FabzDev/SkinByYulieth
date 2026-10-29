import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Client } from '../../shared/types'
import { formatShortDate } from '../../shared/dates'
import { api, buildQuery, errorMessage, fieldError } from '../api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { FormField, SearchField } from '../components/forms'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Money,
  PageHeader,
  Spinner,
} from '../components/ui'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function ClientsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q, 280)
  const [limit, setLimit] = useState(100)
  const [items, setItems] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<{ items: Client[]; total: number }>(
        `/api/clients${buildQuery({ q: debouncedQ.trim(), limit })}`,
      )
      setItems(response.items)
      setTotal(response.total)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, limit])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setName('')
    setPhone('')
    setAllowDuplicate(false)
    setFormError('')
    setCreateOpen(true)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setFormError('Escribe el nombre del cliente.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const response = await api.post<{ item: Client }>('/api/clients', {
        name: name.trim(),
        phone: phone.trim() || null,
        allowDuplicate: allowDuplicate || undefined,
      })
      toast.success('Cliente guardado en el directorio.')
      setCreateOpen(false)
      navigate(`/clientes/${response.item.id}`)
    } catch (err) {
      setFormError(
        fieldError(err, 'name') ?? fieldError(err, 'phone') ?? errorMessage(err),
      )
    } finally {
      setBusy(false)
    }
  }

  const duplicateWarning = /cliente con datos similares/i.test(formError)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Directorio"
        title="Clientes"
        subtitle="Un directorio opcional para reconocer a tus clientas y ver su historial. Las ventas también pueden registrarse sin nombre."
        actions={
          <button type="button" className="button button--primary" onClick={openCreate}>
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            Nuevo cliente
          </button>
        }
      />

      <div className="filter-card">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Buscar por nombre o teléfono"
          ariaLabel="Buscar clientes"
        />
        <p className="filter-hint">
          El saldo pendiente que aparece aquí corresponde a ventas activas del cliente, sin
          importar la fecha.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      <div className="list-summary">
        <span>
          {loading ? 'Buscando…' : `${total} ${total === 1 ? 'cliente' : 'clientes'}`}
        </span>
        {total > items.length && !loading ? <span>Mostrando {items.length}</span> : null}
      </div>

      {loading && !items.length ? (
        <LoadingBlock rows={4} />
      ) : items.length ? (
        <>
          <div className="client-grid">
            {items.map((client) => (
              <Link key={client.id} to={`/clientes/${client.id}`} className="client-card">
                <span className="client-card__avatar">{initials(client.name)}</span>
                <span className="client-card__main">
                  <strong>{client.name}</strong>
                  <small>{client.phone ?? 'Sin teléfono registrado'}</small>
                  <span className="client-card__meta">
                    {client.salesCount ?? 0}{' '}
                    {(client.salesCount ?? 0) === 1 ? 'venta' : 'ventas'} · desde{' '}
                    {formatShortDate(client.createdAt.slice(0, 10))}
                  </span>
                </span>
                <span className="client-card__balance">
                  <span>Debe</span>
                  <Money value={client.pendingBalance ?? 0} tone={(client.pendingBalance ?? 0) > 0 ? 'negative' : 'muted'} />
                </span>
                <span className="client-card__arrow">
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
                Cargar más clientes
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="clients"
          title={q ? 'No encontramos clientes con esa búsqueda' : 'Tu directorio está vacío'}
          message="Puedes crear clientes ahora o dejar el nombre libre al registrar una venta."
          action={
            <button type="button" className="button button--primary" onClick={openCreate}>
              <Icon name="plus" size={17} /> Crear el primer cliente
            </button>
          }
        />
      )}

      <Modal
        open={createOpen}
        title="Nuevo cliente"
        description="Guardar el cliente es opcional. Sirve para encontrar sus ventas y saldos después."
        onClose={() => setCreateOpen(false)}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCreateOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" form="client-create-form" className="button button--primary" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="check" size={17} />}
              Guardar cliente
            </button>
          </>
        }
      >
        <form id="client-create-form" className="form-stack" onSubmit={onSubmit}>
          <FormField label="Nombre" htmlFor="client-name" required>
            <input
              id="client-name"
              className="input"
              type="text"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre de la clienta"
              autoFocus
            />
          </FormField>
          <FormField
            label="Teléfono"
            htmlFor="client-phone"
            hint="Opcional. Se guarda solo con números y el signo +."
          >
            <input
              id="client-phone"
              className="input"
              type="tel"
              value={phone}
              maxLength={40}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="300 000 0000"
            />
          </FormField>
          {formError ? (
            <div className="form-error-box" role="alert">
              <Icon name="alert" size={17} />
              <span>{formError}</span>
            </div>
          ) : null}
          {duplicateWarning ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(event) => setAllowDuplicate(event.target.checked)}
              />
              <span>
                Es otra clienta distinta. Guardar de todos modos.
              </span>
            </label>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}
