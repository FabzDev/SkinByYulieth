import type { ReactNode } from 'react'
import { formatMoneyInputValue, parseMoneyInput } from '../../shared/money'
import { dateTimeToInput, inputDateTimeToLocal } from '../../shared/dates'
import { Icon } from './Icon'

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__required"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  )
}

export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = '0',
  disabled,
  autoFocus,
}: {
  id?: string
  value: number
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <div className={`money-input ${disabled ? 'is-disabled' : ''}`.trim()}>
      <span className="money-input__prefix">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value ? formatMoneyInputValue(value) : ''}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          const parsed = parseMoneyInput(event.target.value)
          if (Number.isSafeInteger(parsed)) onChange(parsed)
        }}
      />
    </div>
  )
}

export function DateTimeField({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="input-with-icon">
      <Icon name="calendar" size={17} />
      <input
        id={id}
        type="datetime-local"
        value={value ? dateTimeToInput(value) : ''}
        disabled={disabled}
        onChange={(event) => onChange(inputDateTimeToLocal(event.target.value))}
      />
    </div>
  )
}

export function DateField({
  id,
  value,
  onChange,
  max,
  min,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  max?: string
  min?: string
}) {
  return (
    <div className="input-with-icon">
      <Icon name="calendar" size={17} />
      <input
        id={id}
        type="date"
        value={value}
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <div className="search-field">
      <Icon name="search" size={18} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
