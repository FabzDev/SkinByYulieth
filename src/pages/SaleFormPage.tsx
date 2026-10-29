import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ClientDetail, SaleDetail, Service } from '../../shared/types'
import { nowForDateTimeInput } from '../../shared/dates'
import { formatCOP } from '../../shared/money'
import { api, errorMessage } from '../api'
import { useToast } from '../context/ToastContext'
import { Icon } from '../components/Icon'
import { ClientPicker } from '../components/ClientPicker'
import { DateTimeField, FormField, MoneyInput } from '../components/forms'
import {
  ErrorBanner,
  FormSection,
  LoadingBlock,
  Money,
  PageHeader,
  SegmentedControl,
  Spinner,
} from '../components/ui'

type Mode = 'catalog' | 'custom'

export function SaleFormPage({ saleId }: { saleId?: number }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const editId = saleId ?? (params.id ? Number(params.id) : undefined)
  const isEdit = Boolean(editId)

  const [mode, setMode] = useState<Mode>(isEdit ? 'custom' : 'catalog')
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [concept, setConcept] = useState('')
  const [total, setTotal] = useState(0)
  const [clientId, setClientId] = useState<number | null>(null)
  const [clientName, setClientName] = useState('')
  const [occurredAt, setOccurredAt] = useState(nowForDateTimeInput())
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) {
      void api
        .get<{ items: Service[] }>('/api/services')
        .then((response) => {
          setServices(response.items)
          if (response.items.length === 0) setMode('custom')
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setServicesLoading(false))
      return
    }

    if (!editId) return
    setLoading(true)
    api
      .get<{ item: SaleDetail }>(`/api/sales/${editId}`)
      .then((response) => {
        const sale = response.item
        setConcept(sale.concept)
        setTotal(sale.total)
        setClientId(sale.clientId)
        setClientName(sale.clientName ?? '')
        setOccurredAt(sale.occurredAt)
        setDescription(sale.description ?? '')
        setMode('custom')
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [editId, isEdit])

  useEffect(() => {
    if (isEdit) return
    const queryClient = searchParams.get('cliente')
    if (!queryClient) return
    const id = Number(queryClient)
    if (!Number.isInteger(id) || id <= 0) return
    api
      .get<ClientDetail>(`/api/clients/${id}`)
      .then((detail) => {
        setClientId(detail.client.id)
        setClientName(detail.client.name)
      })
      .catch(() => {
        // El cliente puede haber sido eliminado; se ignora.
      })
  }, [isEdit, searchParams])

  const onServiceChange = (value: string) => {
    if (!value) {
      setServiceId(null)
      setConcept('')
      return
    }
    const id = Number(value)
    const service = services.find((item) => item.id === id)
    if (!service) return
    setServiceId(service.id)
    setConcept(service.name)
    setTotal(service.defaultPrice)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!total || total <= 0) {
      setError('Escribe el precio de la venta.')
      return
    }
    if (mode === 'catalog' && !serviceId) {
      setError('Selecciona un servicio del catálogo o usa un concepto personalizado.')
      return
    }
    if (mode === 'custom' && !concept.trim()) {
      setError('Escribe el concepto de la venta.')
      return
    }

    setBusy(true)
    try {
      const payload = {
        concept: concept.trim(),
        clientId,
        clientName: clientId ? null : clientName.trim() || null,
        total,
        occurredAt,
        description: description.trim() || null,
      }

      if (isEdit && editId) {
        const response = await api.patch<{ item: SaleDetail }>(`/api/sales/${editId}`, payload)
        toast.success('Venta actualizada.')
        navigate(`/ventas/${response.item.id}`)
      } else {
        const response = await api.post<{ item: SaleDetail }>('/api/sales', {
          ...payload,
          serviceId: mode === 'catalog' ? serviceId : null,
        })
        toast.success('Venta registrada. El saldo queda pendiente hasta recibir el pago.')
        navigate(`/ventas/${response.item.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Editar venta" backTo="/ventas" backLabel="Ventas" />
        <LoadingBlock rows={6} />
      </div>
    )
  }

  return (
    <div className="page page--form">
      <PageHeader
        eyebrow={isEdit ? 'Ventas' : 'Nueva venta'}
        title={isEdit ? 'Editar venta' : 'Registrar venta'}
        subtitle={
          isEdit
            ? 'Corrige los datos de la venta. El precio histórico se conserva.'
            : 'Elige un servicio o escribe un concepto libre. El pago puede registrarse después.'
        }
        backTo={isEdit && editId ? `/ventas/${editId}` : '/ventas'}
        backLabel={isEdit ? 'Detalle de la venta' : 'Ventas'}
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      <form onSubmit={onSubmit} className="form-layout">
        <div className="form-main">
          <FormSection
            title="Servicio realizado"
            description="El nombre y el precio quedan guardados en la venta, aunque después cambie el catálogo."
          >
            {!isEdit ? (
              <SegmentedControl<Mode>
                value={mode}
                onChange={(value) => {
                  setMode(value)
                  if (value === 'catalog' && !serviceId) {
                    setConcept('')
                  }
                }}
                ariaLabel="Tipo de concepto"
                options={[
                  { value: 'catalog', label: 'Del catálogo' },
                  { value: 'custom', label: 'Concepto libre' },
                ]}
              />
            ) : (
              <p className="form-note">
                Esta venta se registró como <strong>{concept}</strong>. Puedes corregir el
                concepto y el precio sin alterar el catálogo.
              </p>
            )}

            {!isEdit && mode === 'catalog' ? (
              servicesLoading ? (
                <LoadingBlock rows={2} />
              ) : services.length ? (
                <FormField label="Servicio" htmlFor="sale-service" required>
                  <select
                    id="sale-service"
                    className="select"
                    value={serviceId ?? ''}
                    onChange={(event) => onServiceChange(event.target.value)}
                  >
                    <option value="">Selecciona un servicio</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {formatCOP(service.defaultPrice)}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : (
                <div className="inline-note inline-note--warning">
                  <Icon name="info" size={17} />
                  <span>
                    El catálogo está vacío. <Link to="/catalogo">Crea un servicio</Link> o
                    registra la venta con un concepto libre.
                  </span>
                </div>
              )
            ) : (
              <FormField
                label="Concepto de la venta"
                htmlFor="sale-concept"
                required
                hint="Ejemplo: limpieza facial, diseño de cejas, venta de producto."
              >
                <input
                  id="sale-concept"
                  className="input"
                  type="text"
                  value={concept}
                  onChange={(event) => setConcept(event.target.value)}
                  maxLength={200}
                  placeholder="¿Qué servicio se realizó?"
                  autoFocus={isEdit}
                />
              </FormField>
            )}

            <FormField
              label="Precio de la venta"
              htmlFor="sale-total"
              required
              hint="Puedes ajustar el precio para esta venta sin modificar el catálogo."
            >
              <MoneyInput id="sale-total" value={total} onChange={setTotal} />
            </FormField>
          </FormSection>

          <FormSection
            title="Cliente y fecha"
            description="El cliente es opcional. Puedes registrar la venta sin nombre."
          >
            <FormField
              label="Cliente"
              hint="Busca en el directorio o escribe un nombre libre. No es obligatorio."
            >
              <ClientPicker
                clientId={clientId}
                name={clientName}
                onChange={(value) => {
                  setClientId(value.clientId)
                  setClientName(value.name)
                }}
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Fecha y hora" htmlFor="sale-date" required>
                <DateTimeField id="sale-date" value={occurredAt} onChange={setOccurredAt} />
              </FormField>
              <FormField label="Descripción" htmlFor="sale-description" hint="Opcional.">
                <input
                  id="sale-description"
                  className="input"
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  placeholder="Detalle breve de la venta"
                />
              </FormField>
            </div>
          </FormSection>
        </div>

        <aside className="form-side">
          <div className="summary-card">
            <p className="eyebrow">Esta venta</p>
            <Money value={total} className="summary-card__total" />
            <ul>
              <li>
                <span>Cliente</span>
                <strong>{clientName || 'Sin nombre'}</strong>
              </li>
              <li>
                <span>Queda como</span>
                <strong>{total > 0 ? 'Pendiente de pago' : '—'}</strong>
              </li>
            </ul>
            <p className="summary-card__note">
              <Icon name="info" size={16} />
              Registrar la venta no suma dinero recibido. El ingreso se reconoce cuando
              registras el pago.
            </p>
          </div>

          <div className="form-actions">
            <button type="submit" className="button button--primary button--block button--large" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="check" size={18} />}
              {isEdit ? 'Guardar cambios' : 'Registrar venta'}
            </button>
            <Link
              to={isEdit && editId ? `/ventas/${editId}` : '/ventas'}
              className="button button--secondary button--block"
            >
              Cancelar
            </Link>
          </div>
        </aside>
      </form>
    </div>
  )
}
