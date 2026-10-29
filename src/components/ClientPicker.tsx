import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Client } from '../../shared/types'
import { api, buildQuery } from '../api'
import { formatCOP } from '../../shared/money'
import { Icon } from './Icon'

export function ClientPicker({
  clientId,
  name,
  onChange,
}: {
  clientId: number | null
  name: string
  onChange: (value: { clientId: number | null; name: string }) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await api.get<{ items: Client[] }>(
          `/api/clients${buildQuery({ q: query.trim(), limit: 8 })}`,
        )
        if (!cancelled) setResults(response.items)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [open, query])

  if (clientId) {
    return (
      <div className="client-picker client-picker--selected">
        <span className="client-picker__chip">
          <Icon name="user" size={16} />
          <span>{name}</span>
          <span className="client-picker__chip-tag">Directorio</span>
          <button
            type="button"
            onClick={() => {
              onChange({ clientId: null, name: '' })
              setQuery('')
              setOpen(true)
            }}
            aria-label="Quitar cliente seleccionado"
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      </div>
    )
  }

  const commitFreeName = (value: string) => {
    onChange({ clientId: null, name: value.trim() })
    setOpen(false)
  }

  return (
    <div className="client-picker" ref={wrapper}>
      <div className="search-field">
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          placeholder="Buscar o escribir un nombre libre"
          aria-label="Cliente"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            onChange({ clientId: null, name: event.target.value })
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitFreeName(query)
            }
          }}
        />
      </div>
      {name && !open ? (
        <p className="field__hint">
          Se guardará el nombre libre «{name}». No queda vinculado al directorio.
        </p>
      ) : null}
      {open ? (
        <div className="client-picker__dropdown">
          {loading ? <p className="client-picker__empty">Buscando clientes…</p> : null}
          {!loading && results.length === 0 ? (
            <p className="client-picker__empty">
              {query.trim()
                ? 'No hay coincidencias en el directorio.'
                : 'Aún no hay clientes en el directorio.'}
            </p>
          ) : null}
          {results.map((client) => (
            <button
              key={client.id}
              type="button"
              className="client-picker__option"
              onClick={() => {
                onChange({ clientId: client.id, name: client.name })
                setQuery('')
                setOpen(false)
              }}
            >
              <span className="client-picker__avatar">
                <Icon name="user" size={15} />
              </span>
              <span>
                <strong>{client.name}</strong>
                <small>{client.phone ?? 'Sin teléfono'}</small>
              </span>
              {client.pendingBalance ? (
                <span className="client-picker__pending">Debe {formatCOP(client.pendingBalance)}</span>
              ) : null}
            </button>
          ))}
          {query.trim() ? (
            <button
              type="button"
              className="client-picker__option client-picker__option--free"
              onClick={() => commitFreeName(query)}
            >
              <span className="client-picker__avatar">
                <Icon name="edit" size={15} />
              </span>
              <span>
                <strong>Usar «{query.trim()}» sin crear cliente</strong>
                <small>El nombre se guarda solo en esta venta.</small>
              </span>
            </button>
          ) : null}
          <div className="client-picker__footer">
            <Link to="/clientes" onClick={() => setOpen(false)}>
              <Icon name="clients" size={15} /> Administrar clientes
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
