import { z } from 'zod'
import {
  isValidLocalDate,
  normalizeLocalDateTime,
} from '../shared/dates'
import { parseMoneyInput } from '../shared/money'
import { AppError } from './errors'

export const localDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => normalizeLocalDateTime(value) !== null, {
    message: 'La fecha y hora no son válidas.',
  })
  .transform((value) => normalizeLocalDateTime(value) as string)

export const localDateSchema = z
  .string()
  .trim()
  .refine((value) => isValidLocalDate(value), { message: 'La fecha no es válida.' })

export const moneySchema = z.preprocess(
  (value) => (typeof value === 'string' ? parseMoneyInput(value) : value),
  z
    .number({ error: 'El valor debe ser un número.' })
    .int('El valor debe ser un número entero de pesos.')
    .positive('El valor debe ser mayor que cero.'),
)

export const nonNegativeMoneySchema = z.preprocess(
  (value) => (typeof value === 'string' ? parseMoneyInput(value) : value),
  z
    .number({ error: 'El valor debe ser un número.' })
    .int('El valor debe ser un número entero de pesos.')
    .min(0, 'El valor no puede ser negativo.'),
)

export const idSchema = z.coerce.number().int().positive()

export const booleanFlexible = z.preprocess((value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === 'true' || value === '1' || value === 'on'
  return false
}, z.boolean())

export function parseId(value: unknown): number {
  const result = idSchema.safeParse(value)
  if (!result.success) {
    throw new AppError('El identificador no es válido.', 400, { code: 'invalid_id' })
  }
  return result.data
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio.')
  .max(200, 'El correo es demasiado largo.')
  .email('El correo no es válido.')
  .transform((value) => value.toLowerCase())

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(120, 'El nombre es demasiado largo.')

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `El texto no puede superar ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))

export const requiredText = (max = 200) =>
  z.string().trim().min(1, 'Este campo es obligatorio.').max(max, 'El texto es demasiado largo.')

export const paymentMethodSchema = z.enum(['cash', 'transfer'], {
  error: 'El método de pago no es válido.',
})

export const dateRangeSchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: 'La fecha inicial no puede ser posterior a la fecha final.',
    path: ['from'],
  })

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export function parseWithSchema<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const details: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : 'general'
    if (!details[key]) details[key] = issue.message
  }
  throw new AppError('Los datos enviados no son válidos.', 400, {
    code: 'validation_error',
    details,
  })
}
