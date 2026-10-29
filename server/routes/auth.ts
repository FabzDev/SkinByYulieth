import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import type { DB } from '../db'
import type { AppConfig } from '../config'
import {
  clearSessionCookie,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getUser,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPasswordWithTimingGuard,
} from '../auth'
import { emailSchema, parseWithSchema } from '../validation'
import { AppError } from '../errors'

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria.').max(200),
})

export function authRoutes(db: DB, config: AppConfig): Router {
  const router = Router()

  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: 'Demasiados intentos de acceso. Espera unos minutos e intenta de nuevo.',
      code: 'rate_limited',
    },
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = parseWithSchema(loginSchema, req.body)
    const user = db
      .prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?')
      .get(email) as
      | { id: number; name: string; email: string; password_hash: string }
      | undefined

    const valid = await verifyPasswordWithTimingGuard(password, user?.password_hash)
    if (!user || !valid) {
      throw new AppError('Correo o contraseña incorrectos.', 401, { code: 'invalid_credentials' })
    }

    deleteExpiredSessions(db)
    const session = createSession(db, user.id, config, {
      userAgent: req.get('user-agent'),
      ip: req.ip,
    })
    setSessionCookie(res, session.token, config)
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      expiresAt: session.expiresAt,
    })
  })

  router.post('/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (token) deleteSession(db, token)
    clearSessionCookie(res, config)
    res.json({ ok: true })
  })

  router.get('/me', requireAuth(db, config), (req, res) => {
    res.json({ user: getUser(req) })
  })

  return router
}
