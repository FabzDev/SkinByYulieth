import { Router } from 'express'
import { z } from 'zod'
import type { DB } from '../db'
import { localDateSchema } from '../validation'
import {
  exportAuditCsv,
  exportClientsCsv,
  exportExpensesCsv,
  exportFileName,
  exportOtherIncomeCsv,
  exportPaymentsCsv,
  exportRefundsCsv,
  exportSalesCsv,
  exportWithdrawalsCsv,
} from '../services/exports'

const exportQuery = z.object({
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
})

const exporters: Record<
  string,
  { label: string; run: (db: DB, from?: string, to?: string) => string }
> = {
  ventas: { label: 'ventas', run: (db, from, to) => exportSalesCsv(db, from, to) },
  pagos: { label: 'pagos', run: (db, from, to) => exportPaymentsCsv(db, from, to) },
  devoluciones: { label: 'devoluciones', run: (db, from, to) => exportRefundsCsv(db, from, to) },
  gastos: { label: 'gastos', run: (db, from, to) => exportExpensesCsv(db, from, to) },
  retiros: { label: 'retiros', run: (db, from, to) => exportWithdrawalsCsv(db, from, to) },
  'otros-ingresos': {
    label: 'otros-ingresos',
    run: (db, from, to) => exportOtherIncomeCsv(db, from, to),
  },
  clientes: { label: 'clientes', run: (db) => exportClientsCsv(db) },
  auditoria: { label: 'auditoria', run: (db, from, to) => exportAuditCsv(db, from, to) },
}

export function exportRoutes(db: DB): Router {
  const router = Router()

  router.get('/export/:kind', (req, res) => {
    const kind = String(req.params.kind)
    const exporter = exporters[kind]
    if (!exporter) {
      res.status(404).json({ error: 'No existe ese tipo de exportación.' })
      return
    }
    const query = exportQuery.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({ error: 'El rango de fechas no es válido.' })
      return
    }
    const { from, to } = query.data
    const csv = exporter.run(db, from, to)
    const filename = exportFileName(exporter.label, from, to)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(csv)
  })

  return router
}
