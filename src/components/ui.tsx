import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { formatCOP } from '../../shared/money'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  backTo,
  backLabel = 'Volver',
}: {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="page-header">
      {backTo ? (
        <Link to={backTo} className="back-link">
          <Icon name="arrowLeft" size={16} />
          {backLabel}
        </Link>
      ) : null}
      <div className="page-header__row">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
    </div>
  )
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={`card ${className}`.trim()}>{children}</Tag>
}

export function EmptyState({
  icon = 'sparkle',
  title,
  message,
  action,
}: {
  icon?: Parameters<typeof Icon>[0]['name']
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Cargando…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div className="loading-block" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-line" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <div className="error-banner" role="alert">
      <Icon name="alert" size={19} />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="button button--ghost button--small" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          className="icon-button"
          onClick={onDismiss}
          aria-label="Cerrar mensaje"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  )
}

export function InlineNote({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' | 'success' }) {
  return <div className={`inline-note inline-note--${tone}`}>{children}</div>
}

export function Money({
  value,
  signed = false,
  className = '',
  tone,
}: {
  value: number
  signed?: boolean
  className?: string
  tone?: 'positive' | 'negative' | 'muted'
}) {
  const text = signed && value > 0 ? `+${formatCOP(value)}` : formatCOP(value)
  return <span className={`money ${tone ? `money--${tone}` : ''} ${className}`.trim()}>{text}</span>
}

export function MetaRow({
  label,
  children,
  mono = false,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  )
}

export function DataStatus({ children }: { children: ReactNode }) {
  return <span className="status-dot">{children}</span>
}

export function PageLoading() {
  return (
    <div className="page">
      <LoadingBlock rows={6} />
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="form-section">
      <div className="form-section__heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="form-section__body">{children}</div>
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}
