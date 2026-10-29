import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandMark, Icon, type IconName } from './Icon'

interface NavItem {
  to: string
  label: string
  icon: IconName
  mobile?: boolean
}

const primaryNav: NavItem[] = [
  { to: '/', label: 'Tablero', icon: 'dashboard', mobile: true },
  { to: '/ventas', label: 'Ventas', icon: 'sales', mobile: true },
  { to: '/clientes', label: 'Clientes', icon: 'clients' },
  { to: '/gastos', label: 'Gastos', icon: 'expenses', mobile: true },
  { to: '/retiros', label: 'Retiros', icon: 'withdrawals' },
  { to: '/otros-ingresos', label: 'Otros ingresos', icon: 'otherIncome' },
]

const adminNav: NavItem[] = [
  { to: '/historial', label: 'Historial', icon: 'history', mobile: true },
  { to: '/auditoria', label: 'Auditoría', icon: 'audit' },
  { to: '/catalogo', label: 'Catálogo', icon: 'catalog' },
  { to: '/datos', label: 'Datos y respaldos', icon: 'backup' },
]

const quickActions: NavItem[] = [
  { to: '/ventas/nueva', label: 'Registrar venta', icon: 'sales' },
  { to: '/pagos/nuevo', label: 'Recibir pago', icon: 'payment' },
  { to: '/gastos/nuevo', label: 'Registrar gasto', icon: 'expenses' },
  { to: '/retiros/nuevo', label: 'Registrar retiro', icon: 'withdrawals' },
  { to: '/otros-ingresos/nuevo', label: 'Otro ingreso', icon: 'otherIncome' },
  { to: '/clientes', label: 'Nuevo cliente', icon: 'clients' },
]

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="sidebar__section">
      <p className="sidebar__title">{title}</p>
      <nav className="sidebar__nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [quickOpen, setQuickOpen] = useState(false)

  useEffect(() => {
    setQuickOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  const initials = (user?.name ?? 'SY')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const moreActive = ['/mas', '/auditoria', '/catalogo', '/datos', '/retiros', '/otros-ingresos'].some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
  )

  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      <aside className="sidebar">
        <Link to="/" className="sidebar__brand" aria-label="Ir al tablero">
          <BrandMark />
          <span>
            <strong>SkinByYulieth</strong>
            <small>Gestión contable</small>
          </span>
        </Link>

        <div className="sidebar__scroll">
          <NavSection title="Día a día" items={primaryNav} />
          <NavSection title="Organización" items={adminNav} />
        </div>

        <div className="sidebar__footer">
          <Link to="/mas" className="sidebar__user">
            <span className="avatar">{initials}</span>
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.email}</small>
            </span>
          </Link>
          <button type="button" className="sidebar__logout" onClick={() => void logout()}>
            <Icon name="logout" size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <Link to="/" className="mobile-header__brand">
            <BrandMark size={34} />
            <span>SkinByYulieth</span>
          </Link>
          <Link to="/mas" className="avatar avatar--small" aria-label="Tu cuenta">
            {initials}
          </Link>
        </header>

        <main id="contenido" className="content">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Navegación principal">
          <NavLink to="/" end className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}>
            <Icon name="dashboard" size={21} />
            <span>Tablero</span>
          </NavLink>
          <NavLink
            to="/ventas"
            className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
          >
            <Icon name="sales" size={21} />
            <span>Ventas</span>
          </NavLink>
          <button
            type="button"
            className="bottom-nav__fab"
            onClick={() => setQuickOpen(true)}
            aria-label="Abrir acciones rápidas"
            aria-expanded={quickOpen}
          >
            <Icon name="plus" size={24} />
          </button>
          <NavLink
            to="/historial"
            className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
          >
            <Icon name="history" size={21} />
            <span>Historial</span>
          </NavLink>
          <Link
            to="/mas"
            className={`bottom-nav__item ${moreActive ? 'is-active' : ''}`}
            aria-label="Más opciones"
          >
            <Icon name="more" size={21} />
            <span>Más</span>
          </Link>
        </nav>
      </div>

      {quickOpen ? (
        <div className="quick-sheet-backdrop" role="presentation" onClick={() => setQuickOpen(false)}>
          <div
            className="quick-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Acciones rápidas"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-sheet__handle" />
            <div className="quick-sheet__header">
              <h2>¿Qué quieres registrar?</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setQuickOpen(false)}
                aria-label="Cerrar"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="quick-sheet__grid">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.to} className="quick-action">
                  <span className="quick-action__icon">
                    <Icon name={action.icon} size={21} />
                  </span>
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
