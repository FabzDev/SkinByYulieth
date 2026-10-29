import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Expense, ExpenseCategory } from '../../shared/types'
import { ALLOWED_RECEIPT_TYPES, MAX_RECEIPT_BYTES } from '../../shared/constants'
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

const MAX_MB = Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)

export function ExpenseFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const toast = useToast()

  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [occurredAt, setOccurredAt] = useState(nowForDateTimeInput())
  const [description, setDescription] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidBusy, setVoidBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const requests: Array<Promise<unknown>> = [
      api
        .get<{ items: ExpenseCategory[] }>('/api/expense-categories?includeInactive=1')
        .then((response) => {
          if (!cancelled) setCategories(response.items)
        }),
    ]
    if (editId) {
      requests.push(
        api
          .get<{ item: Expense }>(`/api/expenses/${editId}`)
          .then((response) => {
            if (cancelled) return
            const item = response.item
            setExpense(item)
            setAmount(item.amount)
            setCategoryId(String(item.categoryId))
            setOccurredAt(item.occurredAt)
            setDescription(item.description ?? '')
          }),
      )
    }
    Promise.all(requests)
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setError('')
    if (!file) {
      setReceipt(null)
      return
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type as (typeof ALLOWED_RECEIPT_TYPES)[number])) {
      setError('El comprobante debe ser una imagen JPG, PNG, WEBP o un PDF.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setError(`El comprobante no puede superar ${MAX_MB} MB.`)
      event.target.value = ''
      return
    }
    setReceipt(file)
    setRemoveReceipt(false)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!amount || amount <= 0) {
      setError('Escribe el valor del gasto.')
      return
    }
    if (!categoryId) {
      setError('Selecciona una categoría.')
      return
    }

    const formData = new FormData()
    formData.set('amount', String(amount))
    formData.set('categoryId', categoryId)
    formData.set('occurredAt', occurredAt)
    formData.set('description', description.trim())
    if (receipt) formData.set('receipt', receipt)
    if (removeReceipt) formData.set('removeReceipt', 'true')

    setBusy(true)
    try {
      if (isEdit && editId) {
        await api.patchForm<{ item: Expense }>(`/api/expenses/${editId}`, formData)
        toast.success('Gasto actualizado.')
      } else {
        await api.postForm<{ item: Expense }>('/api/expenses', formData)
        toast.success('Gasto registrado.')
      }
      navigate('/gastos')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitVoid = async (reason: string) => {
    if (!expense) return
    setVoidBusy(true)
    try {
      const response = await api.post<{ item: Expense }>(`/api/expenses/${expense.id}/void`, {
        reason: reason || null,
      })
      setExpense(response.item)
      setVoidOpen(false)
      toast.success('Gasto anulado. Ya no cuenta en los informes.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setVoidBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title={isEdit ? 'Gasto' : 'Registrar gasto'}
          backTo="/gastos"
          backLabel="Gastos"
        />
        <LoadingBlock rows={5} />
      </div>
    )
  }

  const isVoided = expense?.status === 'voided'
  const hasReceipt = Boolean(expense?.receipt) && !removeReceipt

  return (
    <div className="page page--form">
      <PageHeader
        eyebrow={isEdit ? 'Detalle del gasto' : 'Nuevo gasto'}
        title={
          isEdit
            ? expense?.description || expense?.categoryName || 'Gasto'
            : 'Registrar gasto'
        }
        subtitle={
          isVoided
            ? 'Este gasto está anulado y no cuenta en los informes. Se conserva para la auditoría.'
            : 'El gasto se resta de la ganancia estimada en la fecha indicada.'
        }
        backTo="/gastos"
        backLabel="Gastos"
        actions={
          isEdit && expense && !isVoided ? (
            <button
              type="button"
              className="button button--danger-outline"
              onClick={() => setVoidOpen(true)}
            >
              <Icon name="ban" size={17} /> Anular gasto
            </button>
          ) : undefined
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      {isVoided && expense ? (
        <div className="inline-note inline-note--warning">
          <Icon name="ban" size={18} />
          <span>
            Anulado por {expense.voidedByName ?? '—'}
            {expense.voidedAt ? ` el ${formatDateTime(expense.voidedAt)}` : ''}.
            {expense.voidReason ? ` Motivo: ${expense.voidReason}` : ''}
          </span>
        </div>
      ) : null}

      <div className="form-layout">
        <form id="expense-form" onSubmit={onSubmit} className="form-main">
          <FormSection
            title="Datos del gasto"
            description="Registra el valor realmente pagado y su categoría."
          >
            <div className="form-grid">
              <FormField label="Valor del gasto" htmlFor="expense-amount" required>
                <MoneyInput id="expense-amount" value={amount} onChange={setAmount} disabled={isVoided} />
              </FormField>
              <FormField label="Categoría" htmlFor="expense-category" required>
                <select
                  id="expense-category"
                  className="select"
                  value={categoryId}
                  disabled={isVoided}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.active ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Fecha y hora" htmlFor="expense-date" required>
              <DateTimeField
                id="expense-date"
                value={occurredAt}
                onChange={setOccurredAt}
                disabled={isVoided}
              />
            </FormField>
            <FormField
              label="Descripción"
              htmlFor="expense-description"
              hint="Opcional, pero útil para recordar en qué se gastó."
            >
              <input
                id="expense-description"
                className="input"
                type="text"
                value={description}
                maxLength={500}
                disabled={isVoided}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ejemplo: cremas y mascarillas para la cabina"
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Comprobante"
            description={`Opcional. Imagen JPG, PNG, WEBP o PDF de máximo ${MAX_MB} MB.`}
          >
            {hasReceipt && expense?.receipt ? (
              <div className="receipt-current">
                <span className="receipt-current__icon">
                  <Icon name="file" size={20} />
                </span>
                <div>
                  <strong>{expense.receipt.filename}</strong>
                  <small>
                    {Math.round(expense.receipt.size / 1024)} KB ·{' '}
                    {formatDateTime(expense.updatedAt)}
                  </small>
                </div>
                <a
                  className="button button--secondary button--small"
                  href={`/api/expenses/${expense.id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="eye" size={16} /> Ver
                </a>
                {!isVoided ? (
                  <button
                    type="button"
                    className="button button--danger-ghost button--small"
                    onClick={() => {
                      setRemoveReceipt(true)
                      setReceipt(null)
                    }}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="file-field">
                <input
                  id="expense-receipt"
                  type="file"
                  accept={ALLOWED_RECEIPT_TYPES.join(',')}
                  disabled={isVoided}
                  onChange={onFileChange}
                />
                <label htmlFor="expense-receipt" className="file-field__label">
                  <Icon name="file" size={19} />
                  <span>
                    <strong>{receipt ? receipt.name : 'Adjuntar comprobante'}</strong>
                    <small>
                      {receipt
                        ? `${Math.round(receipt.size / 1024)} KB`
                        : `JPG, PNG, WEBP o PDF · máx. ${MAX_MB} MB`}
                    </small>
                  </span>
                </label>
                {receipt ? (
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setReceipt(null)}
                  >
                    Quitar selección
                  </button>
                ) : null}
              </div>
            )}
            {removeReceipt && !receipt ? (
              <p className="field__hint">
                El comprobante actual se quitará al guardar.
              </p>
            ) : null}
          </FormSection>
        </form>

        <aside className="form-side">
          <div className="summary-card">
            <p className="eyebrow">{isEdit ? 'Gasto registrado' : 'Nuevo gasto'}</p>
            <span className="summary-card__total summary-card__total--expense">
              {formatCOP(amount)}
            </span>
            <ul>
              <li>
                <span>Categoría</span>
                <strong>
                  {categories.find((category) => String(category.id) === categoryId)?.name ?? '—'}
                </strong>
              </li>
              <li>
                <span>Comprobante</span>
                <strong>{receipt ? 'Se adjuntará' : hasReceipt ? 'Adjunto' : 'Sin comprobante'}</strong>
              </li>
              {expense ? (
                <li>
                  <span>Estado</span>
                  <strong><RecordStatusBadge status={expense.status} /></strong>
                </li>
              ) : null}
            </ul>
            <p className="summary-card__note">
              <Icon name="info" size={16} />
              Los gastos son del negocio. Los retiros personales se registran aparte y no
              reducen la ganancia.
            </p>
          </div>

          {!isVoided ? (
            <div className="form-actions">
              <button
                type="submit"
                form="expense-form"
                className="button button--primary button--block button--large"
                disabled={busy}
              >
                {busy ? <Spinner /> : <Icon name="check" size={18} />}
                {isEdit ? 'Guardar cambios' : 'Registrar gasto'}
              </button>
              <Link to="/gastos" className="button button--secondary button--block">
                Cancelar
              </Link>
            </div>
          ) : (
            <Link to="/gastos" className="button button--secondary button--block">
              Volver a gastos
            </Link>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={voidOpen}
        title="Anular gasto"
        description="El gasto quedará anulado y dejará de restar en los informes. No se borra."
        confirmLabel="Anular gasto"
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
