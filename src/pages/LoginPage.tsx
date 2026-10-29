import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark, Icon } from '../components/Icon'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!loading && user) return <Navigate to="/" replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.')
      return
    }
    setBusy(true)
    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero__content">
          <div className="login-hero__brand">
            <BrandMark size={52} />
            <span>SkinByYulieth</span>
          </div>
          <p className="eyebrow eyebrow--light">Contabilidad de tu cabina</p>
          <h1>
            Claridad para tu trabajo,
            <br />
            tranquilidad para tu negocio.
          </h1>
          <p className="login-hero__text">
            Registra ventas, pagos, gastos y retiros en un solo lugar. Sabe cuánto entró,
            cuánto salió y cuánto está pendiente de cobrar.
          </p>
          <div className="login-hero__details">
            <span>
              <Icon name="lock" size={17} /> Acceso privado
            </span>
            <span>
              <Icon name="sparkle" size={17} /> Hecho para el día a día
            </span>
          </div>
        </div>
        <div className="login-hero__ornament" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand">
            <BrandMark size={44} />
            <span>SkinByYulieth</span>
          </div>
          <p className="eyebrow">Bienvenida de nuevo</p>
          <h2>Inicia sesión</h2>
          <p className="login-card__subtitle">
            Usa tu correo y contraseña personal. Cada movimiento queda registrado a tu nombre.
          </p>

          <form onSubmit={onSubmit} className="login-form" noValidate>
            <div className="field">
              <label className="field__label" htmlFor="login-email">
                Correo
              </label>
              <div className="input-with-icon">
                <Icon name="mail" size={17} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  autoFocus
                />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="login-password">
                Contraseña
              </label>
              <div className="input-with-icon input-with-icon--action">
                <Icon name="lock" size={17} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </div>
            </div>

            {error ? (
              <div className="login-error" role="alert">
                <Icon name="alert" size={17} />
                {error}
              </div>
            ) : null}

            <button type="submit" className="button button--primary button--block button--large" disabled={busy}>
              {busy ? <Spinner /> : null}
              Entrar
            </button>
          </form>

          <p className="login-card__footnote">
            <Icon name="lock" size={14} />
            Acceso exclusivo para Yulieth y Fabio. No compartas tu contraseña.
          </p>
        </div>
      </div>
    </div>
  )
}
