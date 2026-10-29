import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ClientDetail } from '../../shared/types'
import { formatDateTime, formatShortDate } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { api, errorMessage, fieldError } from '../api'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { MethodLabel, PaymentStatusBadge, SaleStatusBadge } from '../components/badges'
import { FormField } from '../components/forms'
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

export function ClientDetailPage() {
  const { id } = useParams()
  const clientId = Number(id)
  const toast = useToast()
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    if (!Number.isInteger(clientId) || clientId <= 0) {
      setError('El cliente no es válido.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await api.get<ClientDetail>(`/api/clients/${clientId}`)
      setDetail(response)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = () => {
    if (!detail) return
    setName(detail.client.name)
    setPhone(detail.client.phone ?? '')
    setAllowDuplicate(false)
    setFormError('')
    setEditOpen(true)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!detail) return
    if (!name.trim()) {
      setFormError('El nombre no puede quedar vacío.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      await api.patch(`/api/clients/${detail.client.id}`, {
        name: name.trim(),
        phone: phone.trim() || null,
        allowDuplicate: allowDuplicate || undefined,
      })
      toast.success('Datos del cliente actualizados.')
      setEditOpen(false)
      await load()
    } catch (err) {
      setFormError(
        fieldError(err, 'name') ?? fieldError(err, 'phone') ?? errorMessage(err),
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Cliente" backTo="/clientes" backLabel="Clientes" />
        <LoadingBlock rows={6} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="page">
        <PageHeader title="Cliente" backTo="/clientes" backLabel="Clientes" />
        <ErrorBanner message={error || 'No se pudo cargar el cliente.'} onRetry={() => void load()} />
      </div>
    )
  }

  const { client, sales, payments } = detail
  const activeSales = sales.filter((sale) => sale.status !== 'voided')
  const totalSold = activeSales.reduce((total, sale) => total + sale.total, 0)
  const validPayments = payments.filter((payment) => payment.status === 'valid')
  const totalRefunded = validPayments.reduce((total, payment) => total + payment.refunded, 0)
  const totalReceived = validPayments.reduce(
    (total, payment) => total + payment.amount - payment.refunded,
    0,
  )
  const pending =
    client.pendingBalance ??
    activeSales.reduce((total, sale) => total + Math.max(sale.balance, 0), 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Directorio"
        title={client.name}
        subtitle={client.phone ? `Teléfono: ${client.phone}` : 'Sin teléfono registrado'}
        backTo="/clientes"
        backLabel="Clientes"
        actions={
          <>
            <Link to={`/ventas/nueva?cliente=${client.id}`} className="button button--primary">
              <Icon name="plus" size={17} /> Nueva venta
            </Link>
            <button type="button" className="button button--secondary" onClick={openEdit}>
              <Icon name="edit" size={17} /> Editar
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      <div className="client-hero">
        <div className="client-hero__identity">
          <span className="client-hero__avatar">{initials(client.name)}</span>
          <div>
            <p className="eyebrow">Ficha de la clienta</p>
            <h2>{client.name}</h2>
            <p>
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/\s/g, '')}`} className="text-link">
                  <Icon name="phone" size={15} /> {client.phone}
                </a>
              ) : (
                <span className="muted">Sin teléfono</span>
              )}
            </p>
          </div>
        </div>
        <div className="client-hero__stats">
          <div>
            <span>Ventas</span>
            <strong>{activeSales.length}</strong>
          </div>
          <div>
            <span>Total vendido</span>
            <strong>{formatCOP(totalSold)}</strong>
          </div>
          <div title="Pagos válidos menos devoluciones activas">
            <span>Recibido</span>
            <strong>{formatCOP(totalReceived)}</strong>
          </div>
          <div className={pending > 0 ? 'is-pending' : ''}>
            <span>Por cobrar</span>
            <strong>{formatCOP(pending)}</strong>
          </div>
        </div>
      </div>

      <div className="client-detail-grid">
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Ventas</h2>
              <p>Historial completo, incluidas las ventas anuladas.</p>
            </div>
          </div>
          {sales.length ? (
            <div className="compact-list">
              {sales.map((sale) => (
                <Link
                  key={sale.id}
                  to={`/ventas/${sale.id}`}
                  className={`compact-row ${sale.status === 'voided' ? 'is-voided' : ''}`}
                >
                  <span className="compact-row__main">
                    <strong>{sale.concept}</strong>
                    <small>{formatDateTime(sale.occurredAt)}</small>
                  </span>
                  <span className="compact-row__amount">
                    <Money value={sale.total} />
                    {sale.status !== 'voided' && sale.balance > 0 ? (
                      <small>Saldo {formatCOP(sale.balance)}</small>
                    ) : null}
                  </span>
                  <SaleStatusBadge status={sale.status} />
                  <span className="compact-row__arrow">
                    <Icon name="chevronRight" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="sales"
              title="Este cliente todavía no tiene ventas"
              message="Registra una venta y quedará vinculada a su historial."
              action={
                <Link to={`/ventas/nueva?cliente=${client.id}`} className="button button--primary">
                  <Icon name="plus" size={17} /> Registrar venta
                </Link>
              }
            />
          )}
        </section>

        <aside className="section-block">
          <div className="section-heading">
            <div>
              <h2>Pagos</h2>
              <p>
                Dinero recibido de este cliente
                {totalRefunded > 0
                  ? `, menos ${formatCOP(totalRefunded)} en devoluciones.`
                  : '.'}
              </p>
            </div>
          </div>
          {payments.length ? (
            <div className="compact-list">
              {payments.map((payment) => (
                <Link
                  key={payment.id}
                  to={`/ventas/${payment.saleId}`}
                  className={`compact-row compact-row--payment ${payment.status === 'voided' ? 'is-voided' : ''}`}
                >
                  <span className="compact-row__main">
                    <strong>{payment.saleConcept ?? `Pago #${payment.id}`}</strong>
                    <small>
                      {formatDateTime(payment.occurredAt)} · <MethodLabel method={payment.method} />
                    </small>
                  </span>
                  <span className="compact-row__amount">
                    <Money value={payment.amount} />
                    {payment.refunded > 0 ? (
                      <small className="compact-row__refund">
                        Devuelto {formatCOP(payment.refunded)}
                      </small>
                    ) : null}
                    <PaymentStatusBadge status={payment.status} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="compact-empty">
              <p>Aún no hay pagos registrados a nombre de este cliente.</p>
            </div>
          )}

          <dl className="detail-meta detail-meta--boxed">
            <div className="meta-row">
              <dt>Cliente desde</dt>
              <dd>{formatShortDate(client.createdAt.slice(0, 10))}</dd>
            </div>
            <div className="meta-row">
              <dt>Registrado por</dt>
              <dd>{client.createdByName}</dd>
            </div>
            <div className="meta-row">
              <dt>Última edición</dt>
              <dd>
                {client.updatedByName} · {formatDateTime(client.updatedAt)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <Modal
        open={editOpen}
        title="Editar cliente"
        description="Los cambios quedan registrados en la auditoría."
        onClose={() => setEditOpen(false)}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" form="client-edit-form" className="button button--primary" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="check" size={17} />}
              Guardar cambios
            </button>
          </>
        }
      >
        <form id="client-edit-form" className="form-stack" onSubmit={onSubmit}>
          <FormField label="Nombre" htmlFor="client-edit-name" required>
            <input
              id="client-edit-name"
              className="input"
              type="text"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Teléfono" htmlFor="client-edit-phone" hint="Opcional.">
            <input
              id="client-edit-phone"
              className="input"
              type="tel"
              value={phone}
              maxLength={40}
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>
          {formError ? (
            <div className="form-error-box" role="alert">
              <Icon name="alert" size={17} />
              <span>{formError}</span>
            </div>
          ) : null}
          {/cliente con datos similares/i.test(formError) ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(event) => setAllowDuplicate(event.target.checked)}
              />
              <span>Confirmo que es una clienta distinta.</span>
            </label>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}
