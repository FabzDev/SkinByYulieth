export const BOGOTA_TIME_ZONE = 'America/Bogota'

export const WEEKDAYS_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

export const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function bogotaParts(date: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const result: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') result[part.type] = part.value
  }
  return result
}

/** Fecha y hora actual en Colombia, formato `YYYY-MM-DD HH:mm:ss`. */
export function nowBogota(date = new Date()): string {
  const p = bogotaParts(date)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

/** Fecha actual en Colombia, formato `YYYY-MM-DD`. */
export function todayBogota(date = new Date()): string {
  const p = bogotaParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

export function currentTimeBogota(date = new Date()): string {
  const p = bogotaParts(date)
  return `${p.hour}:${p.minute}`
}

/** Valor para un input datetime-local, con la hora actual de Colombia. */
export function nowForDateTimeInput(date = new Date()): string {
  const p = bogotaParts(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

/**
 * Valida y normaliza una fecha/hora local de Colombia.
 * Acepta `YYYY-MM-DD HH:mm` o `YYYY-MM-DDTHH:mm` (también con segundos).
 */
export function normalizeLocalDateTime(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  )
  if (!match) return null
  const [, y, m, d, h, min, sec] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(min)
  const second = Number(sec ?? '0')
  if (!isRealDate(year, month, day)) return null
  if (hour > 23 || minute > 59 || second > 59) return null
  return `${y}-${m}-${d} ${h}:${min}:${String(second).padStart(2, '0')}`
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  return isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

export function datePart(localDateTime: string): string {
  return localDateTime.slice(0, 10)
}

export function dateTimeToInput(localDateTime: string): string {
  return localDateTime.replace(' ', 'T').slice(0, 16)
}

export function inputDateTimeToLocal(value: string): string {
  const normalized = normalizeLocalDateTime(value)
  return normalized ? normalized.slice(0, 16) : value
}

export function addDays(date: string, amount: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const next = new Date(Date.UTC(y, m - 1, d + amount))
  return next.toISOString().slice(0, 10)
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number) as [number, number]
  const nextMonthStart = Date.UTC(y, m, 1)
  return new Date(nextMonthStart - 86_400_000).toISOString().slice(0, 10)
}

/** Semana de lunes a domingo. */
export function startOfWeekMonday(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  return addDays(date, -offset)
}

export function endOfWeekSunday(date: string): string {
  return addDays(startOfWeekMonday(date), 6)
}

export function addMonths(date: string, amount: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 + amount, 1))
  const lastDay = endOfMonth(target.toISOString().slice(0, 10)).slice(8, 10)
  const day = Math.min(d, Number(lastDay))
  return `${target.toISOString().slice(0, 7)}-${String(day).padStart(2, '0')}`
}

export function currentMonthRange(date = new Date()): { from: string; to: string } {
  const today = todayBogota(date)
  return { from: startOfMonth(today), to: endOfMonth(today) }
}

export function currentWeekRange(date = new Date()): { from: string; to: string } {
  const today = todayBogota(date)
  return { from: startOfWeekMonday(today), to: endOfWeekSunday(today) }
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${MONTHS_ES[m - 1]} de ${y}`
}

export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`
}

export function formatShortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_ES[m - 1]?.slice(0, 3)} ${y}`
}

export function formatDateTime(local: string): string {
  const date = local.slice(0, 10)
  const time = local.slice(11, 16)
  const [h, min] = time.split(':').map(Number) as [number, number]
  const suffix = h >= 12 ? 'p. m.' : 'a. m.'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${formatShortDate(date)} · ${hour12}:${String(min).padStart(2, '0')} ${suffix}`
}

export function formatDateInput(date: string): string {
  return date
}

export function periodLabel(from: string, to: string): string {
  if (from === to) return formatLongDate(from)
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01') && to === endOfMonth(from)) {
    return monthLabel(from.slice(0, 7))
  }
  return `${formatShortDate(from)} – ${formatShortDate(to)}`
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function isDateInRange(date: string, from?: string, to?: string): boolean {
  return (!from || date >= from) && (!to || date <= to)
}
