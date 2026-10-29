export class AppError extends Error {
  statusCode: number
  code?: string
  details?: Record<string, string>

  constructor(
    message: string,
    statusCode = 400,
    options: { code?: string; details?: Record<string, string> } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = options.code
    this.details = options.details
  }
}

export function badRequest(message: string, details?: Record<string, string>): AppError {
  return new AppError(message, 400, { code: 'bad_request', details })
}

export function unauthorized(message = 'Debes iniciar sesión para continuar.'): AppError {
  return new AppError(message, 401, { code: 'unauthorized' })
}

export function forbidden(message = 'No tienes permiso para realizar esta acción.'): AppError {
  return new AppError(message, 403, { code: 'forbidden' })
}

export function notFound(message = 'No se encontró el registro.'): AppError {
  return new AppError(message, 404, { code: 'not_found' })
}

export function conflict(message: string, code = 'conflict', details?: Record<string, string>): AppError {
  return new AppError(message, 409, { code, details })
}
