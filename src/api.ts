import type { ApiErrorBody } from '../shared/types'

export class ApiError extends Error {
  status: number
  code?: string
  details?: Record<string, string>

  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code
    this.details = body?.details
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  formData?: FormData
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {},
  }

  if (options.formData) {
    init.body = options.formData
  } else if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      0,
      {
        error: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
        code: 'network_error',
      },
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? ((await response.json()) as ApiErrorBody & T)
    : null

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('sby:unauthorized'))
    }
    throw new ApiError(
      body?.error ?? 'No se pudo completar la operación.',
      response.status,
      body ?? undefined,
    )
  }

  return (body ?? ({} as T)) as T
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body })
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body })
  },
  postForm<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', formData })
  },
  patchForm<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, { method: 'PATCH', formData })
  },
  async download(path: string, fallbackName: string): Promise<void> {
    const response = await fetch(path, { credentials: 'same-origin' })
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event('sby:unauthorized'))
      let message = 'No se pudo descargar el archivo.'
      try {
        const body = (await response.json()) as ApiErrorBody
        if (body.error) message = body.error
      } catch {
        // Sin cuerpo JSON.
      }
      throw new ApiError(message, response.status)
    }
    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') ?? ''
    const match = /filename="([^"]+)"/.exec(disposition)
    const filename = match?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocurrió un error inesperado.'
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError) return error.details?.[field]
  return undefined
}
