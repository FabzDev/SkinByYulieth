import { useCallback, useEffect, useState } from 'react'
import type { BackupsResponse } from '../../shared/types'
import { currentMonthRange, formatDateTime } from '../../shared/dates'
import { api, buildQuery, errorMessage } from '../api'
import { useToast } from '../context/ToastContext'
import { Icon, type IconName } from '../components/Icon'
import { DateField } from '../components/forms'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Spinner,
} from '../components/ui'

const exportKinds: Array<{
  kind: string
  label: string
  detail: string
  icon: IconName
  usesRange: boolean
}> = [
  {
    kind: 'ventas',
    label: 'Ventas',
    detail: 'Servicios, valores, saldos y estado',
    icon: 'sales',
    usesRange: true,
  },
  {
    kind: 'pagos',
    label: 'Pagos',
    detail: 'Pagos recibidos y anulados',
    icon: 'payment',
    usesRange: true,
  },
  {
    kind: 'devoluciones',
    label: 'Devoluciones',
    detail: 'Dinero devuelto de ventas anuladas',
    icon: 'refresh',
    usesRange: true,
  },
  {
    kind: 'gastos',
    label: 'Gastos',
    detail: 'Categoría, descripción y comprobante',
    icon: 'expenses',
    usesRange: true,
  },
  {
    kind: 'retiros',
    label: 'Retiros',
    detail: 'Dinero retirado para uso personal',
    icon: 'withdrawals',
    usesRange: true,
  },
  {
    kind: 'otros-ingresos',
    label: 'Otros ingresos',
    detail: 'Ingresos fuera de ventas',
    icon: 'otherIncome',
    usesRange: true,
  },
  {
    kind: 'clientes',
    label: 'Clientes',
    detail: 'Directorio completo con saldos',
    icon: 'clients',
    usesRange: false,
  },
  {
    kind: 'auditoria',
    label: 'Auditoría',
    detail: 'Creaciones, ediciones y anulaciones',
    icon: 'audit',
    usesRange: true,
  },
]

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function DataPage() {
  const toast = useToast()
  const [range, setRange] = useState(() => currentMonthRange())
  const [backups, setBackups] = useState<BackupsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [backupBusy, setBackupBusy] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadBackups = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<BackupsResponse>('/api/backups')
      setBackups(response)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const createBackup = async () => {
    setBackupBusy(true)
    try {
      await api.post('/api/backups', {})
      toast.success('Copia de seguridad creada y verificada.')
      await loadBackups()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBackupBusy(false)
    }
  }

  const download = async (kind: string, label: string, usesRange: boolean) => {
    setDownloading(kind)
    try {
      const query = usesRange ? buildQuery({ from: range.from, to: range.to }) : ''
      await api.download(`/api/export/${kind}${query}`, `skinbyyulieth-${kind}.csv`)
      toast.success(`Exportación de ${label.toLowerCase()} descargada.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Seguridad de la información"
        title="Datos y respaldos"
        subtitle="Copia la base de datos y exporta los movimientos. Los archivos contienen información privada del negocio."
      />

      {error ? <ErrorBanner message={error} onRetry={() => void loadBackups()} /> : null}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Copias de seguridad</h2>
            <p>
              El servidor crea copias automáticas y las verifica. Conserva solo las más recientes
              según la retención configurada.
            </p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void createBackup()}
            disabled={backupBusy}
          >
            {backupBusy ? <Spinner /> : <Icon name="backup" size={17} />}
            Crear copia ahora
          </button>
        </div>

        <div className="backup-summary">
          <div>
            <span className="backup-summary__label">Última copia</span>
            <strong>
              {backups?.lastBackupAt ? formatDateTime(backups.lastBackupAt) : 'Aún no hay copias'}
            </strong>
          </div>
          <div>
            <span className="backup-summary__label">Copias disponibles</span>
            <strong>{backups?.backups.length ?? 0}</strong>
          </div>
          <div className="backup-summary__path">
            <span className="backup-summary__label">Carpeta en el servidor</span>
            <code>{backups?.directory ?? '—'}</code>
          </div>
        </div>

        {loading ? (
          <LoadingBlock rows={3} />
        ) : backups?.backups.length ? (
          <div className="backup-list">
            {backups.backups.map((backup) => (
              <div key={backup.filename} className="backup-row">
                <span className="backup-row__icon">
                  <Icon name="backup" size={19} />
                </span>
                <span className="backup-row__main">
                  <strong>{backup.filename}</strong>
                  <small>
                    {formatDateTime(backup.createdAt)} · {formatBytes(backup.size)}
                  </small>
                </span>
                <span className="badge badge--success">Verificada</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="backup"
            title="Todavía no hay copias de seguridad"
            message="Crea una copia manual ahora. También puedes programar copias automáticas en el servidor."
            action={
              <button
                type="button"
                className="button button--primary"
                onClick={() => void createBackup()}
                disabled={backupBusy}
              >
                {backupBusy ? <Spinner /> : <Icon name="backup" size={17} />}
                Crear la primera copia
              </button>
            }
          />
        )}

        <div className="inline-note inline-note--warning">
          <Icon name="alert" size={17} />
          <span>
            Las copias quedan en el disco del servidor. Copia el archivo fuera de este equipo
            periódicamente (por ejemplo, con scp o desde el panel de tu proveedor) y guárdalo en
            un lugar seguro. El procedimiento de restauración está en el README del proyecto.
          </span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Exportar movimientos</h2>
            <p>
              Archivos CSV compatibles con Excel, con separador punto y coma y codificación UTF-8.
              Elige el período antes de descargar.
            </p>
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-row">
            <div className="filter-field">
              <span>Desde</span>
              <DateField value={range.from} max={range.to} onChange={(value) => setRange((r) => ({ ...r, from: value }))} />
            </div>
            <div className="filter-field">
              <span>Hasta</span>
              <DateField value={range.to} min={range.from} onChange={(value) => setRange((r) => ({ ...r, to: value }))} />
            </div>
          </div>
          <p className="filter-hint">
            El directorio de clientes se exporta completo. Los demás archivos usan las fechas de
            cada movimiento.
          </p>
        </div>

        <div className="export-grid">
          {exportKinds.map((item) => (
            <button
              key={item.kind}
              type="button"
              className="export-card"
              disabled={downloading === item.kind}
              onClick={() => void download(item.kind, item.label, item.usesRange)}
            >
              <span className="export-card__icon">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="export-card__main">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="export-card__action">
                {downloading === item.kind ? <Spinner /> : <Icon name="download" size={18} />}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
