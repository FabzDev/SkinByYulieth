import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import type { DB } from './db'
import type { AppConfig } from './config'
import type { SessionUser } from '../shared/types'
import { nowBogota } from '../shared/dates'
import { unauthorized } from './errors'

export const SESSION_COOKIE = 'sby_session'

export interface AuthedRequest extends Request {
  user: SessionUser
}

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-only', 10)

export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return bcrypt.hash(password, rounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function verifyPasswordWithTimingGuard(
  password: string,
  hash: string | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH)
    return false
  }
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres.'
  if (password.length > 200) return 'La contraseña es demasiado larga.'
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password)) return 'La contraseña debe incluir al menos una letra.'
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.'
  return null
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export interface SessionCreateResult {
  token: string
  expiresAt: string
}

export function createSession(
  db: DB,
  userId: number,
  config: AppConfig,
  meta: { userAgent?: string; ip?: string } = {},
): SessionCreateResult {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const now = new Date()
  const expires = new Date(now.getTime() + config.sessionDays * 86_400_000)
  const nowLocal = nowBogota(now)

  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    tokenHash,
    expires.toISOString(),
    nowLocal,
    nowLocal,
    meta.userAgent?.slice(0, 300) ?? null,
    meta.ip?.slice(0, 80) ?? null,
  )

  return { token, expiresAt: expires.toISOString() }
}

export function deleteSession(db: DB, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function deleteExpiredSessions(db: DB): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
}

export function getSessionUser(
  db: DB,
  token: string | undefined,
): SessionUser | null {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as
    | { id: number; name: string; email: string; expires_at: string }
    | undefined

  if (!row) return null
  if (Date.parse(row.expires_at) <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
    return null
  }

  // Actualización liviana: solo si pasó más de un día desde el último uso.
  const lastSeen = db
    .prepare('SELECT last_seen_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token)) as { last_seen_at: string } | undefined
  if (lastSeen) {
    const lastSeenDate = new Date(lastSeen.last_seen_at.replace(' ', 'T') + '-05:00')
    if (Date.now() - lastSeenDate.getTime() > 86_400_000) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(
        nowBogota(),
        hashToken(token),
      )
    }
  }

  return { id: row.id, name: row.name, email: row.email }
}

export function sessionCookieOptions(config: AppConfig): {
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionDays * 86_400_000,
  }
}

export function setSessionCookie(
  res: Response,
  token: string,
  config: AppConfig,
): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config))
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  })
}

export function requireAuth(db: DB, config: AppConfig) {
  return (req: Request, _res: Response, next: (error?: unknown) => void): void => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    const user = getSessionUser(db, token)
    if (!user) {
      next(unauthorized())
      return
    }
    ;(req as AuthedRequest).user = user
    next()
  }
}

export function getUser(req: Request): SessionUser {
  const user = (req as AuthedRequest).user
  if (!user) throw unauthorized()
  return user
}
