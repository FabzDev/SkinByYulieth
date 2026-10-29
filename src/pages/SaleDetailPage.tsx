import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Payment, SaleDetail } from '../../shared/types'
import type { PaymentMethod } from '../../shared/constants'
import { nowForDateTimeInput, formatDateTime } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { api, errorMessage } from '../api'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { MethodLabel, PaymentStatusBadge, SaleStatusBadge } from '../components/badges'
import { DateTimeField, FormField, MoneyInput } from '../components/forms'
import { ConfirmDialog, Modal } from '../components/Modal'
import {
  ErrorBanner,
  LoadingBlock,
  MetaRow,
  Money,
  PageHeader,
  Spinner,
} from '../components/ui'

type VoidAction = 'refund' | 'void' | 'retain'

export function SaleDetailPage() {
  const { id } = useParams()
  const saleId = Number(id)
  const toast = useToast()
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [voidOpen, setVoidOpen] = useState(false)
  const [voidAction, setVoidAction] = useState<VoidAction>('refund')
  const [voidReason, setVoidReason] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)
  const [voidError, setVoidError] = useState('')

  const [editPayment, setEditPayment] = useState<Payment | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const [voidPaymentTarget, setVoidPaymentTarget] = useState<Payment | null>(null)
  const [voidPaymentBusy, setVoidPaymentBusy] = useState(false)

  const [refundOpen, setRefundOpen] = useState(false)
  const [refundPaymentId, setRefundPaymentId] = useState<number | null>(null)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundDate, setRefundDate] = useState(nowForDateTimeInput())
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  const [refundReason, setRefundReason] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundError, setRefundError] = useState('')

  const [voidRefundTarget, setVoidRefundTarget] = useState<number | null>(null)
  const [voidRefundBusy, setVoidRefundBusy] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(saleId) || saleId <= 0) {
      setError('La venta no es válida.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await api.get<{ item: SaleDetail }>(`/api/sales/${saleId}`)
      setSale(response.item)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [saleId])

  useEffect(() => {
    void load()
  }, [load])

  const openVoid = () => {
    setVoidAction('refund')
    setVoidReason('')
    setVoidError('')
    setVoidOpen(true)
  }

  const submitVoid = async () => {
    if (!sale) return
    setVoidBusy(true)
    setVoidError('')
    try {
      const response = await api.post<{ item: SaleDetail }>(`/api/sales/${sale.id}/void`, {
        reason: voidReason.trim() || null,
        paymentAction: sale.paid > 0 ? voidAction : null,
      })
      setSale(response.item)
      setVoidOpen(false)
      toast.success('La venta fue anulada y quedó registrada en la auditoría.')
    } catch (err) {
      setVoidError(errorMessage(err))
    } finally {
      setVoidBusy(false)
    }
  }

  const openEditPayment = (payment: Payment) => {
    setEditPayment(payment)
    setPaymentAmount(payment.amount)
    setPaymentDate(payment.occurredAt)
    setPaymentMethod(payment.method)
    setPaymentError('')
  }

  const submitEditPayment = async (event: FormEvent) => {
    event.preventDefault()
    if (!editPayment) return
    setPaymentBusy(true)
    setPaymentError('')
    try {
      const response = await api.patch<{ item: SaleDetail }>(`/api/payments/${editPayment.id}`, {
        amount: paymentAmount,
        occurredAt: paymentDate,
        method: paymentMethod,
      })
      setSale(response.item)
      setEditPayment(null)
      toast.success('Pago actualizado.')
    } catch (err) {
      setPaymentError(errorMessage(err))
    } finally {
      setPaymentBusy(false)
    }
  }

  const submitVoidPayment = async (reason: string) => {
    if (!voidPaymentTarget) return
    setVoidPaymentBusy(true)
    try {
      const response = await api.post<{ item: SaleDetail }>(
        `/api/payments/${voidPaymentTarget.id}/void`,
        { reason: reason || null },
      )
      setSale(response.item)
      setVoidPaymentTarget(null)
      toast.success('Pago anulado. La venta actualizó su saldo.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setVoidPaymentBusy(false)
    }
  }

  const openRefund = () => {
    if (!sale) return
    const refundable = sale.payments.find(
      (payment) => payment.status === 'valid' && payment.amount - payment.refunded > 0,
    )
    if (!refundable) {
      toast.info('No hay pagos con saldo disponible para devolver.')
      return
    }
    setRefundPaymentId(refundable.id)
    setRefundAmount(refundable.amount - refundable.refunded)
    setRefundDate(nowForDateTimeInput())
    setRefundMethod(refundable.method)
    setRefundReason('')
    setRefundError('')
    setRefundOpen(true)
  }

  const selectedRefundPayment = sale?.payments.find((payment) => payment.id === refundPaymentId)
  const refundableAmount = selectedRefundPayment
    ? selectedRefundPayment.amount - selectedRefundPayment.refunded
    : 0

  const selectRefundPayment = (value: string) => {
    const paymentId = Number(value)
    const payment = sale?.payments.find((item) => item.id === paymentId)
    setRefundPaymentId(paymentId)
    if (payment) {
      setRefundAmount(payment.amount - payment.refunded)
      setRefundMethod(payment.method)
    }
  }

  const submitRefund = async (event: FormEvent) => {
    event.preventDefault()
    if (!sale || !refundPaymentId) return
    if (!refundAmount || refundAmount <= 0) {
      setRefundError('Escribe el valor de la devolución.')
      return
    }
    if (refundAmount > refundableAmount) {
      setRefundError(`El máximo disponible para este pago es ${formatCOP(refundableAmount)}.`)
      return
    }
    setRefundBusy(true)
    setRefundError('')
    try {
      const response = await api.post<{ item: SaleDetail }>(`/api/sales/${sale.id}/refunds`, {
        paymentId: refundPaymentId,
        amount: refundAmount,
        occurredAt: refundDate,
        method: refundMethod,
        reason: refundReason.trim() || null,
      })
      setSale(response.item)
      setRefundOpen(false)
      toast.success('Devolución registrada. Se descuenta de los ingresos del período.')
    } catch (err) {
      setRefundError(errorMessage(err))
    } finally {
      setRefundBusy(false)
    }
  }

  const submitVoidRefund = async (reason: string) => {
    if (!voidRefundTarget) return
    setVoidRefundBusy(true)
    try {
      const response = await api.post<{ item: SaleDetail }>(`/api/refunds/${voidRefundTarget}/void`, {
        reason: reason || null,
      })
      setSale(response.item)
      setVoidRefundTarget(null)
      toast.success('Devolución anulada.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setVoidRefundBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Venta" backTo="/ventas" backLabel="Ventas" />
        <LoadingBlock rows={6} />
      </div>
    )
  }

  if (!sale) {
    return (
      <div className="page">
        <PageHeader title="Venta" backTo="/ventas" backLabel="Ventas" />
        <ErrorBanner message={error || 'No se pudo cargar la venta.'} onRetry={() => void load()} />
      </div>
    )
  }

  const refundablePayments = sale.payments.filter(
    (payment) => payment.status === 'valid' && payment.amount - payment.refunded > 0,
  )
  const hasRefundable = refundablePayments.length > 0

  return (
    <div className="page">
      <PageHeader
        eyebrow="Detalle de la venta"
        title={sale.concept}
        subtitle={
          <span className="detail-subtitle">
            <SaleStatusBadge status={sale.status} />
            <span>{sale.clientName || 'Sin cliente'}</span>
          </span>
        }
        backTo="/ventas"
        backLabel="Ventas"
        actions={
          <>
            {sale.status !== 'voided' && sale.balance > 0 ? (
              <Link to={`/pagos/nuevo?venta=${sale.id}`} className="button button--primary">
                <Icon name="payment" size={17} /> Recibir pago
              </Link>
            ) : null}
            {sale.status !== 'voided' ? (
              <Link to={`/ventas/${sale.id}/editar`} className="button button--secondary">
                <Icon name="edit" size={17} /> Editar
              </Link>
            ) : null}
            {sale.status !== 'voided' ? (
              <button type="button" className="button button--danger-outline" onClick={openVoid}>
                <Icon name="ban" size={17} /> Anular
              </button>
            ) : hasRefundable ? (
              <button type="button" className="button button--secondary" onClick={openRefund}>
                <Icon name="refresh" size={17} /> Registrar devolución
              </button>
            ) : null}
          </>
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      <div className="detail-summary">
        <div className="detail-summary__main">
          <p className="eyebrow">Valor de la venta</p>
          <Money value={sale.total} className="detail-summary__total" />
          <div className="detail-summary__chips">
            <span className="detail-chip">
              Recibido <Money value={sale.paid} />
            </span>
            <span className="detail-chip">
              {sale.status === 'voided' ? 'Saldo' : 'Pendiente'} <Money value={sale.balance} />
            </span>
            {sale.refunded > 0 ? (
              <span className="detail-chip detail-chip--danger">
                Devuelto <Money value={sale.refunded} />
              </span>
            ) : null}
          </div>
          <p className="detail-summary__note">
            {sale.status === 'voided'
              ? 'Esta venta está anulada. No genera saldo pendiente ni cuenta como venta activa.'
              : sale.balance === 0
                ? 'El pago cubre el total de la venta.'
                : 'El saldo pendiente es lo que aún falta por cobrar.'}
          </p>
        </div>

        <dl className="detail-meta">
          <MetaRow label="Fecha de la venta">{formatDateTime(sale.occurredAt)}</MetaRow>
          <MetaRow label="Cliente">{sale.clientName || 'Sin cliente'}</MetaRow>
          <MetaRow label="Registrada por">{sale.createdByName}</MetaRow>
          <MetaRow label="Última edición">
            {sale.updatedByName} · {formatDateTime(sale.updatedAt)}
          </MetaRow>
          {sale.description ? <MetaRow label="Descripción">{sale.description}</MetaRow> : null}
          {sale.status === 'voided' ? (
            <>
              <MetaRow label="Anulada por">{sale.voidedByName ?? '—'}</MetaRow>
              <MetaRow label="Fecha de anulación">
                {sale.voidedAt ? formatDateTime(sale.voidedAt) : '—'}
              </MetaRow>
              {sale.voidReason ? <MetaRow label="Motivo">{sale.voidReason}</MetaRow> : null}
            </>
          ) : null}
        </dl>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Pagos recibidos</h2>
            <p>Cada pago se cuenta como ingreso en la fecha en que se recibió.</p>
          </div>
          {sale.status !== 'voided' && sale.balance > 0 ? (
            <Link to={`/pagos/nuevo?venta=${sale.id}`} className="text-link">
              <Icon name="plus" size={15} /> Agregar pago
            </Link>
          ) : null}
        </div>

        {sale.payments.length ? (
          <div className="payment-list">
            {sale.payments.map((payment) => {
              const refundable = payment.amount - payment.refunded
              return (
                <div key={payment.id} className={`payment-row ${payment.status === 'voided' ? 'is-voided' : ''}`}>
                  <span className={`payment-row__icon payment-row__icon--${payment.status}`}>
                    <Icon name="payment" size={18} />
                  </span>
                  <div className="payment-row__main">
                    <div className="payment-row__top">
                      <strong><Money value={payment.amount} /></strong>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <p>
                      {formatDateTime(payment.occurredAt)} · <MethodLabel method={payment.method} /> ·
                      Registrado por {payment.createdByName}
                    </p>
                    {payment.refunded > 0 ? (
                      <p className="payment-row__refund">Devuelto: <Money value={payment.refunded} /></p>
                    ) : null}
                    {payment.voidReason ? <p className="payment-row__reason">Motivo: {payment.voidReason}</p> : null}
                  </div>
                  {sale.status !== 'voided' && payment.status === 'valid' ? (
                    <div className="payment-row__actions">
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => openEditPayment(payment)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button button--danger-ghost button--small"
                        onClick={() => setVoidPaymentTarget(payment)}
                      >
                        Anular
                      </button>
                    </div>
                  ) : payment.status === 'valid' && refundable > 0 ? (
                    <span className="payment-row__available">Disponible: {formatCOP(refundable)}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="compact-empty">
            <p>Aún no hay pagos registrados para esta venta.</p>
            {sale.status !== 'voided' ? (
              <Link to={`/pagos/nuevo?venta=${sale.id}`} className="button button--secondary button--small">
                Registrar el primer pago
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {sale.refunds.length ? (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>Devoluciones</h2>
              <p>Salidas de dinero asociadas a pagos de esta venta anulada.</p>
            </div>
          </div>
          <div className="payment-list">
            {sale.refunds.map((refund) => (
              <div key={refund.id} className={`payment-row ${refund.status === 'voided' ? 'is-voided' : ''}`}>
                <span className="payment-row__icon payment-row__icon--refund">
                  <Icon name="refresh" size={18} />
                </span>
                <div className="payment-row__main">
                  <div className="payment-row__top">
                    <strong><Money value={refund.amount} /></strong>
                    <span className={`badge badge--${refund.status === 'active' ? 'warning' : 'neutral'}`}>
                      {refund.status === 'active' ? 'Activa' : 'Anulada'}
                    </span>
                  </div>
                  <p>
                    {formatDateTime(refund.occurredAt)} · <MethodLabel method={refund.method} /> ·
                    Pago #{refund.paymentId} · {refund.createdByName}
                  </p>
                  {refund.reason ? <p className="payment-row__reason">Motivo: {refund.reason}</p> : null}
                </div>
                {refund.status === 'active' ? (
                  <button
                    type="button"
                    className="button button--danger-ghost button--small"
                    onClick={() => setVoidRefundTarget(refund.id)}
                  >
                    Anular
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        open={voidOpen}
        title="Anular venta"
        description="La venta se conserva con su historial. No se borrará información."
        onClose={() => setVoidOpen(false)}
        busy={voidBusy}
        footer={
          <>
            <button type="button" className="button button--secondary" onClick={() => setVoidOpen(false)} disabled={voidBusy}>
              Cancelar
            </button>
            <button type="button" className="button button--danger" onClick={() => void submitVoid()} disabled={voidBusy}>
              {voidBusy ? <Spinner /> : <Icon name="ban" size={17} />}
              Anular venta
            </button>
          </>
        }
      >
        {sale.paid > 0 ? (
          <div className="void-options">
            <p className="form-note">
              Esta venta ya tiene <strong>{formatCOP(sale.paid)}</strong> recibidos. Indica qué
              ocurrió con ese dinero para que los informes sigan siendo claros.
            </p>
            <label className={`void-option ${voidAction === 'refund' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="void-action"
                value="refund"
                checked={voidAction === 'refund'}
                onChange={() => setVoidAction('refund')}
              />
              <span>
                <strong>Devolví el dinero</strong>
                <small>El pago se conserva y se registra una devolución que descuenta el ingreso.</small>
              </span>
            </label>
            <label className={`void-option ${voidAction === 'void' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="void-action"
                value="void"
                checked={voidAction === 'void'}
                onChange={() => setVoidAction('void')}
              />
              <span>
                <strong>Fue un error de registro</strong>
                <small>Los pagos también se anulan y dejan de contar como ingresos.</small>
              </span>
            </label>
            <label className={`void-option ${voidAction === 'retain' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="void-action"
                value="retain"
                checked={voidAction === 'retain'}
                onChange={() => setVoidAction('retain')}
              />
              <span>
                <strong>Retuve el dinero</strong>
                <small>Los pagos se anulan y el valor recibido pasa a Otros ingresos.</small>
              </span>
            </label>
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="void-sale-reason">
            Motivo <span className="field__hint">(opcional)</span>
          </label>
          <textarea
            id="void-sale-reason"
            className="textarea"
            rows={3}
            value={voidReason}
            maxLength={500}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="Ejemplo: la clienta canceló, registro duplicado…"
          />
        </div>
        {voidError ? <ErrorBanner message={voidError} /> : null}
      </Modal>

      <Modal
        open={Boolean(editPayment)}
        title="Editar pago"
        description="El pago se contabiliza en la fecha que indiques."
        onClose={() => setEditPayment(null)}
        busy={paymentBusy}
        footer={
          <>
            <button type="button" className="button button--secondary" onClick={() => setEditPayment(null)} disabled={paymentBusy}>
              Cancelar
            </button>
            <button type="submit" form="edit-payment-form" className="button button--primary" disabled={paymentBusy}>
              {paymentBusy ? <Spinner /> : null}
              Guardar pago
            </button>
          </>
        }
      >
        <form id="edit-payment-form" onSubmit={submitEditPayment} className="form-stack">
          <FormField label="Valor" htmlFor="edit-payment-amount" required>
            <MoneyInput id="edit-payment-amount" value={paymentAmount} onChange={setPaymentAmount} />
          </FormField>
          <div className="form-grid">
            <FormField label="Fecha y hora" htmlFor="edit-payment-date" required>
              <DateTimeField id="edit-payment-date" value={paymentDate} onChange={setPaymentDate} />
            </FormField>
            <FormField label="Método" htmlFor="edit-payment-method">
              <select
                id="edit-payment-method"
                className="select"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </FormField>
          </div>
          {paymentError ? <ErrorBanner message={paymentError} /> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(voidPaymentTarget)}
        title="Anular pago"
        description="El pago quedará anulado y dejará de contar en los ingresos. La venta recalculará su saldo."
        confirmLabel="Anular pago"
        danger
        withReason
        reasonLabel="Motivo de la anulación (opcional)"
        busy={voidPaymentBusy}
        onClose={() => setVoidPaymentTarget(null)}
        onConfirm={(reason) => void submitVoidPayment(reason)}
      />

      <Modal
        open={refundOpen}
        title="Registrar devolución"
        description="La devolución se descuenta de los ingresos en la fecha indicada."
        onClose={() => setRefundOpen(false)}
        busy={refundBusy}
        footer={
          <>
            <button type="button" className="button button--secondary" onClick={() => setRefundOpen(false)} disabled={refundBusy}>
              Cancelar
            </button>
            <button type="submit" form="refund-form" className="button button--primary" disabled={refundBusy}>
              {refundBusy ? <Spinner /> : null}
              Registrar devolución
            </button>
          </>
        }
      >
        <form id="refund-form" onSubmit={submitRefund} className="form-stack">
          <FormField label="Pago que se devuelve" htmlFor="refund-payment" required>
            <select
              id="refund-payment"
              className="select"
              value={refundPaymentId ?? ''}
              onChange={(event) => selectRefundPayment(event.target.value)}
            >
              {refundablePayments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  Pago #{payment.id} · {formatDateTime(payment.occurredAt)} · Disponible{' '}
                  {formatCOP(payment.amount - payment.refunded)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Valor de la devolución" htmlFor="refund-amount" required>
            <MoneyInput id="refund-amount" value={refundAmount} onChange={setRefundAmount} />
          </FormField>
          <div className="form-grid">
            <FormField label="Fecha y hora" htmlFor="refund-date" required>
              <DateTimeField id="refund-date" value={refundDate} onChange={setRefundDate} />
            </FormField>
            <FormField label="Método" htmlFor="refund-method">
              <select
                id="refund-method"
                className="select"
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </FormField>
          </div>
          <FormField label="Motivo" htmlFor="refund-reason">
            <textarea
              id="refund-reason"
              className="textarea"
              rows={3}
              value={refundReason}
              maxLength={500}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="Motivo de la devolución"
            />
          </FormField>
          {refundError ? <ErrorBanner message={refundError} /> : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(voidRefundTarget)}
        title="Anular devolución"
        description="La devolución dejará de descontar ingresos. La venta seguirá anulada."
        confirmLabel="Anular devolución"
        danger
        withReason
        busy={voidRefundBusy}
        onClose={() => setVoidRefundTarget(null)}
        onConfirm={(reason) => void submitVoidRefund(reason)}
      />
    </div>
  )
}
