import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, PageHeader } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="page">
      <PageHeader eyebrow="Página no encontrada" title="Esta dirección no existe" backTo="/" backLabel="Ir al tablero" />
      <EmptyState
        icon="search"
        title="No encontramos lo que buscabas"
        message="Puede que el enlace esté mal escrito o que el registro ya no esté disponible."
        action={
          <Link to="/" className="button button--primary">
            <Icon name="dashboard" size={17} /> Volver al tablero
          </Link>
        }
      />
    </div>
  )
}
