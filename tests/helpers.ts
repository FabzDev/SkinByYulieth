import type { DB } from '../server/db'
import { openDatabase } from '../server/db'
import type { SessionUser } from '../shared/types'
import { nowBogota } from '../shared/dates'

export function createTestDb(): { db: DB; yulieth: SessionUser; fabio: SessionUser } {
  const db = openDatabase(':memory:')
  const now = nowBogota()
  const insert = db.prepare(
    `INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  )
  insert.run('Yulieth', 'yulieth@test.local', 'not-a-real-hash', now, now)
  insert.run('Fabio', 'fabio@test.local', 'not-a-real-hash', now, now)
  return {
    db,
    yulieth: { id: 1, name: 'Yulieth', email: 'yulieth@test.local' },
    fabio: { id: 2, name: 'Fabio', email: 'fabio@test.local' },
  }
}

export function createTestService(
  db: DB,
  user: SessionUser,
  name = 'Limpieza facial',
  price = 140_000,
): number {
  const now = nowBogota()
  const result = db
    .prepare(
      `INSERT INTO services (name, default_price, active, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
    )
    .run(name, price, now, now, user.id, user.id)
  return Number(result.lastInsertRowid)
}
