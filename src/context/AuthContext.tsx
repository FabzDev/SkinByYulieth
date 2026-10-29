import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SessionUser } from '../../shared/types'
import { api } from '../api'

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  loadError: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const response = await api.get<{ user: SessionUser }>('/api/auth/me')
      setUser(response.user)
    } catch (error) {
      setUser(null)
      if (error && typeof error === 'object' && 'status' in error && error.status === 0) {
        setLoadError('No se pudo conectar con el servidor. Verifica que esté funcionando.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('sby:unauthorized', handler)
    return () => window.removeEventListener('sby:unauthorized', handler)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ user: SessionUser }>('/api/auth/login', { email, password })
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {})
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, loadError, login, logout, refresh }),
    [user, loading, loadError, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
