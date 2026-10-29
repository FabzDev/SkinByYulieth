import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandMark } from './Icon'
import { Spinner } from './ui'

export function ProtectedRoute() {
  const { user, loading, loadError, refresh } = useAuth()
  const location = useLocation()
  const [retrying, setRetrying] = useState(false)

  if (loading) {
    return (
      <div className="boot-screen">
        <BrandMark size={48} />
        <p>Abriendo tu contabilidad…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="boot-screen">
        <BrandMark size={48} />
        <h1>No pudimos conectar</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className="button button--primary"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true)
            await refresh()
            setRetrying(false)
          }}
        >
          {retrying ? <Spinner /> : null}
          Reintentar
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
