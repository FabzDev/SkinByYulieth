import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon, type IconName } from '../components/Icon'
import { PageHeader } from '../components/ui'

const sections: Array<{
  title: string
  links: Array<{ to: string; label: string; detail: string; icon: IconName }>
}> = [
  {
    title: 'Organización',
    links: [
      {
        to: '/clientes',
        label: 'Clientes',
        detail: 'Directorio, saldos e historial por clienta',
        icon: 'clients',
      },
      {
        to: '/catalogo',
        label: 'Catálogo',
        detail: 'Servicios, precios y categorías de gasto',
        icon: 'catalog',
      },
      {
        to: '/historial',
        label: 'Historial',
        detail: 'Todos los movimientos en orden cronológico',
        icon: 'history',
      },
      {
        to: '/auditoria',
        label: 'Auditoría',
        detail: 'Quién creó, editó o anuló cada registro',
        icon: 'audit',
      },
      {
        to: '/datos',
        label: 'Datos y respaldos',
        detail: 'Copias de seguridad y exportaciones',
        icon: 'backup',
      },
    ],
  },
  {
    title: 'Registrar',
    links: [
      {
        to: '/ventas/nueva',
        label: 'Nueva venta',
        detail: 'Servicio del catálogo o concepto libre',
        icon: 'sales',
      },
      {
        to: '/pagos/nuevo',
        label: 'Recibir pago',
        detail: 'Abono o pago total de una venta',
        icon: 'payment',
      },
      {
        to: '/gastos/nuevo',
        label: 'Registrar gasto',
        detail: 'Salida de dinero del negocio',
        icon: 'expenses',
      },
      {
        to: '/retiros/nuevo',
        label: 'Registrar retiro',
        detail: 'Dinero para uso personal',
        icon: 'withdrawals',
      },
      {
        to: '/otros-ingresos/nuevo',
        label: 'Otro ingreso',
        detail: 'Dinero recibido fuera de una venta',
        icon: 'otherIncome',
      },
    ],
  },
]

export function MorePage() {
  const { user, logout } = useAuth()
  const initials = (user?.name ?? 'SY')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="page">
      <PageHeader
        eyebrow="Tu cuenta"
        title="Más"
        subtitle="Accesos de organización, registros y respaldos de la contabilidad."
      />

      <section className="profile-card">
        <span className="profile-card__avatar">{initials}</span>
        <div className="profile-card__main">
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          <span className="badge badge--success">Sesión activa</span>
        </div>
        <button type="button" className="button button--secondary" onClick={() => void logout()}>
          <Icon name="logout" size={17} /> Cerrar sesión
        </button>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="section-block">
          <div className="section-heading">
            <div>
              <h2>{section.title}</h2>
            </div>
          </div>
          <div className="more-grid">
            {section.links.map((link) => (
              <Link key={link.to} to={link.to} className="more-link">
                <span className="more-link__icon">
                  <Icon name={link.icon} size={20} />
                </span>
                <span className="more-link__main">
                  <strong>{link.label}</strong>
                  <small>{link.detail}</small>
                </span>
                <Icon name="chevronRight" size={17} className="more-link__arrow" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Acerca de esta aplicación</h2>
            <p>
              Contabilidad privada de SkinByYulieth. Las dos cuentas comparten la misma
              información y cada movimiento queda firmado con el usuario que lo registró.
            </p>
          </div>
        </div>
        <dl className="detail-meta detail-meta--boxed">
          <div className="meta-row">
            <dt>Versión</dt>
            <dd>1.0.0</dd>
          </div>
          <div className="meta-row">
            <dt>Zona horaria</dt>
            <dd>Colombia (America/Bogota)</dd>
          </div>
          <div className="meta-row">
            <dt>Moneda</dt>
            <dd>Peso colombiano (COP), valores enteros</dd>
          </div>
          <div className="meta-row">
            <dt>Datos</dt>
            <dd>Base SQLite privada en el servidor</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
