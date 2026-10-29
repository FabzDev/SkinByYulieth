import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Withdrawal } from '../../shared/types'
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

export function WithdrawalFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const toast = useToast()

  const [amount, setAmount] = useState(0)
  const [occurredAt, setOccurredAt] = useState(nowForDateTimeInput())
  const [description, setDescription] = useState('')
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidBusy, setVoidBusy] = useState(false)

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    api
      .get<{ item: Withdrawal }>(`/api/withdrawals/${editId}`)
      .then((response) => {
        const item = response.item
        setWithdrawal(item)
        setAmount(item.amount)
        setOccurredAt(item.occurredAt)
        setDescription(item.description ?? '')
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [editId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!amount || amount <= 0) {
      setError('Escribe el valor del retiro.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        amount,
        occurredAt,
        description: description.trim() || null,
      }
      if (isEdit && editId) {
        await api.patch(`/api/withdrawals/${editId}`, payload)
        toast.success('Retiro actualizado.')
      } else {
        await api.post('/api/withdrawals', payload)
        toast.success('Retiro registrado.')
      }
      navigate('/retiros')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitVoid = async (reason: string) => {
    if (!withdrawal) return
    setVoidBusy(true)
    try {
      const response = await api.post<{ item: Withdrawal }>(
        `/api/withdrawals/${withdrawal.id}/void`,
        { reason: reason || null },
      )
      setWithdrawal(response.item)
      setVoidOpen(false)
      toast.success('Retiro anulado.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setVoidBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Retiro" backTo="/retiros" backLabel="Retiros" />
        <LoadingBlock rows={4} />
      </div>
    )
  }

  const isVoided = withdrawal?.status === 'voided'

  return (
    <div className="page page--form">
      <PageHeader
        eyebrow={isEdit ? 'Detalle del retiro' : 'Nuevo retiro'}
        title={isEdit ? withdrawal?.description || 'Retiro personal' : 'Registrar retiro'}
        subtitle={
          isVoided
            ? 'Este retiro está anulado y no cuenta en los informes.'
            : 'El retiro no es un gasto del negocio ni reduce la ganancia estimada.'
        }
        backTo="/retiros"
        backLabel="Retiros"
        actions={
          isEdit && withdrawal && !isVoided ? (
            <button
              type="button"
              className="button button--danger-outline"
              onClick={() => setVoidOpen(true)}
            >
              <Icon name="ban" size={17} /> Anular retiro
            </button>
          ) : undefined
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      {isVoided && withdrawal ? (
        <div className="inline-note inline-note--warning">
          <Icon name="ban" size={18} />
          <span>
            Anulado por {withdrawal.voidedByName ?? '—'}
            {withdrawal.voidedAt ? ` el ${formatDateTime(withdrawal.voidedAt)}` : ''}.
            {withdrawal.voidReason ? ` Motivo: ${withdrawal.voidReason}` : ''}
          </span>
        </div>
      ) : null}

      <div className="form-layout">
        <form id="withdrawal-form" onSubmit={onSubmit} className="form-main">
          <FormSection
            title="Datos del retiro"
            description="Este dinero salió del negocio hacia tu uso personal."
          >
            <div className="form-grid">
              <FormField label="Valor retirado" htmlFor="withdrawal-amount" required>
                <MoneyInput
                  id="withdrawal-amount"
                  value={amount}
                  onChange={setAmount}
                  disabled={isVoided}
                />
              </FormField>
              <FormField label="Fecha y hora" htmlFor="withdrawal-date" required>
                <DateTimeField
                  id="withdrawal-date"
                  value={occurredAt}
                  onChange={setOccurredAt}
                  disabled={isVoided}
                />
              </FormField>
            </div>
            <FormField
              label="Descripción"
              htmlFor="withdrawal-description"
              hint="Opcional. Ejemplo: mercado, pago personal, dinero para casa."
            >
              <input
                id="withdrawal-description"
                className="input"
                type="text"
                value={description}
                maxLength={500}
                disabled={isVoided}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="¿Para qué retiraste el dinero?"
              />
            </FormField>
          </FormSection>
        </form>

        <aside className="form-side">
          <div className="summary-card">
            <p className="eyebrow">{isEdit ? 'Retiro registrado' : 'Nuevo retiro'}</p>
            <span className="summary-card__total">{formatCOP(amount)}</span>
            <ul>
              <li>
                <span>Sale del negocio</span>
                <strong>Sí</strong>
              </li>
              <li>
                <span>Reduce la ganancia</span>
                <strong>No</strong>
              </li>
              {withdrawal ? (
                <li>
                  <span>Estado</span>
                  <strong><RecordStatusBadge status={withdrawal.status} /></strong>
                </li>
              ) : null}
            </ul>
            <p className="summary-card__note">
              <Icon name="info" size={16} />
              Si el dinero se usó para una necesidad del negocio, regístralo como gasto en vez de
              retiro.
            </p>
          </div>

          {!isVoided ? (
            <div className="form-actions">
              <button
                type="submit"
                form="withdrawal-form"
                className="button button--primary button--block button--large"
                disabled={busy}
              >
                {busy ? <Spinner /> : <Icon name="check" size={18} />}
                {isEdit ? 'Guardar cambios' : 'Registrar retiro'}
              </button>
              <Link to="/retiros" className="button button--secondary button--block">
                Cancelar
              </Link>
            </div>
          ) : (
            <Link to="/retiros" className="button button--secondary button--block">
              Volver a retiros
            </Link>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={voidOpen}
        title="Anular retiro"
        description="El retiro quedará anulado y dejará de contar en los informes. No se borra."
        confirmLabel="Anular retiro"
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
