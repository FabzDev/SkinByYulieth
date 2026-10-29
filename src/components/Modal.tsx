import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Spinner } from './ui'

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
  busy = false,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  busy?: boolean
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, busy])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <div
        className={`modal ${wide ? 'modal--wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  withReason = false,
  reasonLabel = 'Motivo (opcional)',
  reasonRequired = false,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  withReason?: boolean
  reasonLabel?: string
  reasonRequired?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  children?: ReactNode
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setError('')
    }
  }, [open])

  const handleConfirm = () => {
    if (reasonRequired && !reason.trim()) {
      setError('Escribe un motivo para continuar.')
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {withReason ? (
        <div className="field">
          <label className="field__label" htmlFor="confirm-reason">
            {reasonLabel}
          </label>
          <textarea
            id="confirm-reason"
            className="textarea"
            rows={3}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setError('')
            }}
            maxLength={500}
            autoFocus
          />
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
