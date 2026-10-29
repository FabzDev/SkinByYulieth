const integerFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** Formatea pesos colombianos enteros: 140000 -> "$140.000". */
export function formatCOP(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0)
  if (!Number.isFinite(value)) return '$0'
  const formatted = integerFormatter.format(Math.abs(Math.round(value)))
  return value < 0 ? `-$${formatted}` : `$${formatted}`
}

/** Separa miles para un campo de entrada: 140000 -> "140.000". */
export function formatMoneyInputValue(value: string | number): string {
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  return integerFormatter.format(Number(digits))
}

/** Convierte el texto de un campo de dinero a pesos enteros. */
export function parseMoneyInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function isValidMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export function safeMoney(value: unknown): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

export function sumMoney(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + safeMoney(value), 0)
}
