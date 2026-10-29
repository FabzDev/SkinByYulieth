import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ExpenseCategory, Service } from '../../shared/types'
import { formatCOP } from '../../shared/money'
import { api, errorMessage } from '../api'
import { useToast } from '../context/ToastContext'
import { ActiveBadge } from '../components/badges'
import { Icon } from '../components/Icon'
import { FormField, MoneyInput } from '../components/forms'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SegmentedControl,
  Spinner,
} from '../components/ui'

type Tab = 'services' | 'categories'

type EditorState =
  | { kind: 'service'; item?: Service }
  | { kind: 'category'; item?: ExpenseCategory }
  | null

export function CatalogPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('services')
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [toggleBusy, setToggleBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [serviceResponse, categoryResponse] = await Promise.all([
        api.get<{ items: Service[] }>('/api/services?includeInactive=1'),
        api.get<{ items: ExpenseCategory[] }>('/api/expense-categories?includeInactive=1'),
      ])
      setServices(serviceResponse.items)
      setCategories(categoryResponse.items)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditor({ kind: tab === 'services' ? 'service' : 'category' })
    setName('')
    setPrice(0)
    setFormError('')
  }

  const openEdit = (entry: EditorState) => {
    if (!entry) return
    setEditor(entry)
    setName(entry.item?.name ?? '')
    setPrice(entry.kind === 'service' ? (entry.item?.defaultPrice ?? 0) : 0)
    setFormError('')
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor) return
    if (!name.trim()) {
      setFormError(editor.kind === 'service' ? 'Escribe el nombre del servicio.' : 'Escribe el nombre de la categoría.')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      if (editor.kind === 'service') {
        if (editor.item) {
          await api.patch(`/api/services/${editor.item.id}`, {
            name: name.trim(),
            defaultPrice: price,
          })
          toast.success('Servicio actualizado.')
        } else {
          await api.post('/api/services', { name: name.trim(), defaultPrice: price })
          toast.success('Servicio creado. Ya aparece al registrar ventas.')
        }
      } else if (editor.item) {
        await api.patch(`/api/expense-categories/${editor.item.id}`, { name: name.trim() })
        toast.success('Categoría actualizada.')
      } else {
        await api.post('/api/expense-categories', { name: name.trim() })
        toast.success('Categoría creada.')
      }
      setEditor(null)
      await load()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (kind: 'service' | 'category', id: number, active: boolean) => {
    setToggleBusy(id)
    try {
      if (kind === 'service') {
        await api.patch(`/api/services/${id}`, { active: !active })
      } else {
        await api.patch(`/api/expense-categories/${id}`, { active: !active })
      }
      toast.success(active ? 'Registro desactivado.' : 'Registro reactivado.')
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setToggleBusy(null)
    }
  }

  const activeCount =
    tab === 'services'
      ? services.filter((service) => service.active).length
      : categories.filter((category) => category.active).length
  const totalCount = tab === 'services' ? services.length : categories.length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Configuración"
        title="Catálogo"
        subtitle="Servicios y categorías que usas al registrar movimientos. Se desactivan, nunca se borran, para conservar el historial."
        actions={
          <button type="button" className="button button--primary" onClick={openCreate}>
            <span className="button__icon"><Icon name="plus" size={17} /></span>
            {tab === 'services' ? 'Nuevo servicio' : 'Nueva categoría'}
          </button>
        }
      />

      <div className="filter-card filter-card--inline">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          ariaLabel="Catálogo"
          options={[
            { value: 'services', label: `Servicios (${services.length})` },
            { value: 'categories', label: `Categorías (${categories.length})` },
          ]}
        />
        <p className="filter-hint">
          {tab === 'services'
            ? 'El precio del catálogo es solo una sugerencia. Cada venta guarda el precio que se cobró.'
            : 'Las categorías organizan los gastos. El nombre queda guardado en cada gasto aunque después lo cambies.'}
        </p>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <LoadingBlock rows={5} />
      ) : tab === 'services' ? (
        services.length ? (
          <>
            <div className="list-summary">
              <span>
                {activeCount} de {totalCount} servicios activos
              </span>
            </div>
            <div className="catalog-list">
              {services.map((service) => (
                <div key={service.id} className={`catalog-row ${service.active ? '' : 'is-inactive'}`}>
                  <span className="catalog-row__icon">
                    <Icon name="sparkle" size={19} />
                  </span>
                  <div className="catalog-row__main">
                    <div className="catalog-row__title">
                      <h3>{service.name}</h3>
                      <ActiveBadge active={service.active} />
                    </div>
                    <p>
                      Precio sugerido: <strong>{formatCOP(service.defaultPrice)}</strong>
                    </p>
                  </div>
                  <div className="catalog-row__actions">
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => openEdit({ kind: 'service', item: service })}
                    >
                      <Icon name="edit" size={15} /> Editar
                    </button>
                    <button
                      type="button"
                      className={`button button--small ${service.active ? 'button--danger-ghost' : 'button--secondary'}`}
                      disabled={toggleBusy === service.id}
                      onClick={() => void toggleActive('service', service.id, service.active)}
                    >
                      {toggleBusy === service.id ? <Spinner /> : null}
                      {service.active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="catalog"
            title="Tu catálogo de servicios está vacío"
            message="Crea los servicios que ofreces para elegirlos al registrar una venta. También puedes vender con conceptos libres."
            action={
              <button type="button" className="button button--primary" onClick={openCreate}>
                <Icon name="plus" size={17} /> Crear el primer servicio
              </button>
            }
          />
        )
      ) : categories.length ? (
        <>
          <div className="list-summary">
            <span>
              {activeCount} de {totalCount} categorías activas
            </span>
          </div>
          <div className="catalog-list">
            {categories.map((category) => (
              <div key={category.id} className={`catalog-row ${category.active ? '' : 'is-inactive'}`}>
                <span className="catalog-row__icon">
                  <Icon name="expenses" size={19} />
                </span>
                <div className="catalog-row__main">
                  <div className="catalog-row__title">
                    <h3>{category.name}</h3>
                    <ActiveBadge active={category.active} />
                  </div>
                  <p>Se usa para clasificar los gastos del negocio.</p>
                </div>
                <div className="catalog-row__actions">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => openEdit({ kind: 'category', item: category })}
                  >
                    <Icon name="edit" size={15} /> Editar
                  </button>
                  <button
                    type="button"
                    className={`button button--small ${category.active ? 'button--danger-ghost' : 'button--secondary'}`}
                    disabled={toggleBusy === category.id}
                    onClick={() => void toggleActive('category', category.id, category.active)}
                  >
                    {toggleBusy === category.id ? <Spinner /> : null}
                    {category.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon="expenses"
          title="No hay categorías de gasto"
          message="Crea una categoría para clasificar tus gastos."
          action={
            <button type="button" className="button button--primary" onClick={openCreate}>
              <Icon name="plus" size={17} /> Crear categoría
            </button>
          }
        />
      )}

      <div className="inline-note">
        <Icon name="info" size={17} />
        <span>
          Desactivar un servicio o categoría no altera ventas ni gastos anteriores. Solo deja de
          aparecer en los formularios nuevos.
        </span>
      </div>

      <Modal
        open={Boolean(editor)}
        title={
          editor?.item
            ? editor.kind === 'service'
              ? 'Editar servicio'
              : 'Editar categoría'
            : editor?.kind === 'service'
              ? 'Nuevo servicio'
              : 'Nueva categoría'
        }
        description={
          editor?.kind === 'service'
            ? 'El precio es una sugerencia para nuevas ventas; no modifica ventas anteriores.'
            : 'Las categorías organizan los gastos del negocio.'
        }
        onClose={() => setEditor(null)}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditor(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" form="catalog-form" className="button button--primary" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="check" size={17} />}
              {editor?.item ? 'Guardar cambios' : 'Crear'}
            </button>
          </>
        }
      >
        <form id="catalog-form" className="form-stack" onSubmit={onSubmit}>
          <FormField
            label={editor?.kind === 'service' ? 'Nombre del servicio' : 'Nombre de la categoría'}
            htmlFor="catalog-name"
            required
          >
            <input
              id="catalog-name"
              className="input"
              type="text"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder={editor?.kind === 'service' ? 'Ejemplo: limpieza facial' : 'Ejemplo: productos'}
              autoFocus
            />
          </FormField>
          {editor?.kind === 'service' ? (
            <FormField
              label="Precio sugerido"
              htmlFor="catalog-price"
              hint="Puedes dejarlo en cero y escribir el precio en cada venta."
            >
              <MoneyInput id="catalog-price" value={price} onChange={setPrice} />
            </FormField>
          ) : null}
          {formError ? (
            <div className="form-error-box" role="alert">
              <Icon name="alert" size={17} />
              <span>{formError}</span>
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}
