import type { DB } from './db'
import { nowBogota } from '../shared/dates'

export interface AuditInput {
  userId: number
  action: string
  entityType: string
  entityId: number
  summary: string
  reason?: string | null
  before?: unknown
  after?: unknown
}

function safeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null
  try {
    const json = JSON.stringify(value)
    if (json.length > 50_000) return JSON.stringify({ truncated: true, reason: 'too_large' })
    return json
  } catch {
    return JSON.stringify({ error: 'unserializable' })
  }
}

export function recordAudit(db: DB, input: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, summary, reason, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.userId,
    input.action,
    input.entityType,
    input.entityId,
    input.summary,
    input.reason ?? null,
    safeJson(input.before),
    safeJson(input.after),
    nowBogota(),
  )
}
