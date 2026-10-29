import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { OtherIncome } from '../../shared/types'
import { formatDateTime, nowForDateTimeInput } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { api, errorMessage } from '../api'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { RecordStatusBadge } from '../components/badges'
import { DateTimeField, FormField, MoneyInput } from '../components/forms'
import { ConfirmDialog } from '../components/Modal'
import {
  ErrorBanner,
  FormSection,
  LoadingBlock,
  PageHeader,
  Spinner,
} from '../components/ui'

export function OtherIncomeFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const toast = useToast()

  const [amount, setAmount] = useState(0)
  const [occurredAt, setOccurredAt] = useState(nowForDateTimeInput())
  const [concept, setConcept] = useState('')
  const [income, setIncome] = useState<OtherIncome | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidBusy, setVoidBusy] = useState(false)

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    api
      .get<{ item: OtherIncome }>(`/api/other-income/${editId}`)
      .then((response) => {
        const item = response.item
        setIncome(item)
        setAmount(item.amount)
        setOccurredAt(item.occurredAt)
        setConcept(item.concept)
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [editId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!amount || amount <= 0) {
      setError('Escribe el valor del ingreso.')
      return
    }
    if (!concept.trim()) {
      setError('Escribe el concepto del ingreso.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        amount,
        occurredAt,
        concept: concept.trim(),
      }
      if (isEdit && editId) {
        await api.patch(`/api/other-income/${editId}`, payload)
        toast.success('Otro ingreso actualizado.')
      } else {
        await api.post('/api/other-income', payload)
        toast.success('Otro ingreso registrado.')
      }
      navigate('/otros-ingresos')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitVoid = async (reason: string) => {
    if (!income) return
    setVoidBusy(true)
    try {
      const response = await api.post<{ item: OtherIncome }>(
        `/api/other-income/${income.id}/void`,
        { reason: reason || null },
      )
      setIncome(response.item)
      setVoidOpen(false)
      toast.success('Otro ingreso anulado.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setVoidBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Otro ingreso" backTo="/otros-ingresos" backLabel="Otros ingresos" />
        <LoadingBlock rows={4} />
      </div>
    )
  }

  const isVoided = income?.status === 'voided'

  return (
    <div className="page page--form">
      <PageHeader
        eyebrow={isEdit ? 'Detalle del ingreso' : 'Nuevo ingreso'}
        title={isEdit ? income?.concept || 'Otro ingreso' : 'Registrar otro ingreso'}
        subtitle={
          isVoided
            ? 'Este ingreso está anulado y no cuenta en los informes.'
            : 'Se suma a los ingresos recibidos del período en la fecha indicada.'
        }
        backTo="/otros-ingresos"
        backLabel="Otros ingresos"
        actions={
          isEdit && income && !isVoided ? (
            <button
              type="button"
              className="button button--danger-outline"
              onClick={() => setVoidOpen(true)}
            >
              <Icon name="ban" size={17} /> Anular ingreso
            </button>
          ) : undefined
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      {isVoided && income ? (
        <div className="inline-note inline-note--warning">
          <Icon name="ban" size={18} />
          <span>
            Anulado por {income.voidedByName ?? '—'}
            {income.voidedAt ? ` el ${formatDateTime(income.voidedAt)}` : ''}.
            {income.voidReason ? ` Motivo: ${income.voidReason}` : ''}
          </span>
        </div>
      ) : null}

      {income?.sourceSaleId ? (
        <div className="inline-note">
          <Icon name="info" size={17} />
          <span>
            Este ingreso se creó al retener el dinero de la venta anulada #{income.sourceSaleId}.{' '}
            <Link to={`/ventas/${income.sourceSaleId}`} className="text-link">
              Ver la venta
            </Link>
          </span>
        </div>
      ) : null}

      <div className="form-layout">
        <form id="other-income-form" onSubmit={onSubmit} className="form-main">
          <FormSection
            title="Datos del ingreso"
            description="No lo uses para ventas de servicios: esas se registran en Ventas."
          >
            <div className="form-grid">
              <FormField label="Valor recibido" htmlFor="income-amount" required>
                <MoneyInput
                  id="income-amount"
                  value={amount}
                  onChange={setAmount}
                  disabled={isVoided}
                />
              </FormField>
              <FormField label="Fecha y hora" htmlFor="income-date" required>
                <DateTimeField
                  id="income-date"
                  value={occurredAt}
                  onChange={setOccurredAt}
                  disabled={isVoided}
                />
              </FormField>
            </div>
            <FormField
              label="Concepto"
              htmlFor="income-concept"
              required
              hint="Ejemplo: venta de producto, clase externa, dinero retenido."
            >
              <input
                id="income-concept"
                className="input"
                type="text"
                value={concept}
                maxLength={200}
                disabled={isVoided}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="¿De qué fue el ingreso?"
              />
            </FormField>
          </FormSection>
        </form>

        <aside className="form-side">
          <div className="summary-card">
            <p className="eyebrow">{isEdit ? 'Ingreso registrado' : 'Nuevo ingreso'}</p>
            <span className="summary-card__total summary-card__total--income">{formatCOP(amount)}</span>
            <ul>
              <li>
                <span>Suma a ingresos</span>
                <strong>Sí</strong>
              </li>
              <li>
                <span>Venta de servicio</span>
                <strong>No</strong>
              </li>
              {income ? (
                <li>
                  <span>Estado</span>
                  <strong><RecordStatusBadge status={income.status} /></strong>
                </li>
              ) : null}
            </ul>
            <p className="summary-card__note">
              <Icon name="info" size={16} />
              Para servicios del catálogo registra una venta y luego su pago. Así conservas el
              saldo pendiente de cada clienta.
            </p>
          </div>

          {!isVoided ? (
            <div className="form-actions">
              <button
                type="submit"
                form="other-income-form"
                className="button button--primary button--block button--large"
                disabled={busy}
              >
                {busy ? <Spinner /> : <Icon name="check" size={18} />}
                {isEdit ? 'Guardar cambios' : 'Registrar ingreso'}
              </button>
              <Link to="/otros-ingresos" className="button button--secondary button--block">
                Cancelar
              </Link>
            </div>
          ) : (
            <Link to="/otros-ingresos" className="button button--secondary button--block">
              Volver a otros ingresos
            </Link>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={voidOpen}
        title="Anular otro ingreso"
        description="El ingreso quedará anulado y dejará de sumar en los informes. No se borra."
        confirmLabel="Anular ingreso"
        danger
        withReason
        reasonLabel="Motivo de la anulación (opcional)"
        busy={voidBusy}
        onClose={() => setVoidOpen(false)}
        onConfirm={(reason) => void submitVoid(reason)}
      />
    </div>
  )
}
