import { afterEach, describe, expect, it } from 'vitest'
import type { DB } from '../server/db'
import { closeDatabase } from '../server/db'
import { createTestDb, createTestService } from './helpers'
import {
  createPayment,
  createRefund,
  createSale,
  getDashboard,
  getSaleDetail,
  listPayments,
  listSales,
  updatePayment,
  updateSale,
  voidPayment,
  voidSale,
} from '../server/services/sales'
import { createExpense, createOtherIncome, createWithdrawal } from '../server/services/records'
import { createCategory, createClient, listClients, listServices, updateService } from '../server/services/catalog'
import { addDays, endOfWeekSunday, startOfWeekMonday } from '../shared/dates'

let db: DB

function setup() {
  const test = createTestDb()
  db = test.db
  return test
}

afterEach(() => {
  if (db) closeDatabase(db)
})

describe('Caso A — venta pagada completamente', () => {
  it('deja saldo cero y estado pagada', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    const paid = createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 140_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    expect(paid.status).toBe('paid')
    expect(paid.paid).toBe(140_000)
    expect(paid.balance).toBe(0)

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.payments).toBe(140_000)
    expect(dashboard.received.total).toBe(140_000)
    expect(dashboard.pending.total).toBe(0)
  })
})

describe('Caso B — venta pagada parcialmente', () => {
  it('calcula el saldo pendiente y actualiza el estado', () => {
    const { yulieth, fabio } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    const partial = createPayment(db, fabio, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'transfer',
    })
    expect(partial.status).toBe('partial')
    expect(partial.balance).toBe(40_000)
    expect(partial.payments[0]?.createdBy).toBe(fabio.id)

    const complete = createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 40_000,
      occurredAt: '2026-10-05 11:00:00',
      method: 'cash',
    })
    expect(complete.status).toBe('paid')
    expect(complete.balance).toBe(0)

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.payments).toBe(140_000)
    expect(dashboard.pending.total).toBe(0)
  })

  it('rechaza pagos superiores al saldo', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    expect(() =>
      createPayment(db, yulieth, {
        saleId: sale.id,
        amount: 40_001,
        occurredAt: '2026-10-05 11:00:00',
        method: 'cash',
      }),
    ).toThrow(/supera el saldo/)
  })
})

describe('Caso C — pago posterior', () => {
  it('conserva la fecha de la venta y reconoce el cobro en el período del pago', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-09-28 16:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 140_000,
      occurredAt: '2026-10-02 09:00:00',
      method: 'transfer',
    })

    const september = getDashboard(db, '2026-09-01', '2026-09-30')
    const october = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(september.received.total).toBe(0)
    expect(september.salesTotal).toBe(140_000)
    expect(october.received.total).toBe(140_000)

    const detail = getSaleDetail(db, sale.id)
    expect(detail.occurredAt).toBe('2026-09-28 16:00:00')
    expect(detail.status).toBe('paid')
    expect(detail.balance).toBe(0)
  })
})

describe('Caso D — ganancia estimada y retiros separados', () => {
  it('no resta los retiros de la ganancia', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 500_000,
      occurredAt: '2026-10-02 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 500_000,
      occurredAt: '2026-10-02 10:05:00',
      method: 'cash',
    })
    createExpense(db, yulieth, {
      amount: 180_000,
      categoryId: 1,
      occurredAt: '2026-10-03 12:00:00',
      description: 'Productos',
    })
    createWithdrawal(db, yulieth, {
      amount: 70_000,
      occurredAt: '2026-10-04 18:00:00',
      description: 'Retiro familiar',
    })

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.total).toBe(500_000)
    expect(dashboard.expenses).toBe(180_000)
    expect(dashboard.estimatedProfit).toBe(320_000)
    expect(dashboard.withdrawals).toBe(70_000)
  })
})

describe('Caso E — compra de equipo', () => {
  it('cuenta el equipo como gasto pagado del MVP', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 500_000,
      occurredAt: '2026-10-02 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 500_000,
      occurredAt: '2026-10-02 10:05:00',
      method: 'cash',
    })
    createExpense(db, yulieth, {
      amount: 300_000,
      categoryId: 3,
      occurredAt: '2026-10-10 12:00:00',
      description: 'Camilla nueva',
    })
    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.expenses).toBe(300_000)
    expect(dashboard.estimatedProfit).toBe(200_000)
  })
})

describe('Caso F — anulación de venta con pagos', () => {
  it('anula pagos como error de registro y no deja saldo artificial', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const voided = voidSale(db, yulieth, sale.id, {
      reason: 'Registro duplicado',
      paymentAction: 'void',
    })
    expect(voided.status).toBe('voided')
    expect(voided.payments.every((payment) => payment.status === 'voided')).toBe(true)
    expect(voided.balance).toBe(0)

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.total).toBe(0)
    expect(dashboard.pending.total).toBe(0)

    const audit = db.prepare('SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?').all('sale', sale.id)
    expect(audit.length).toBeGreaterThanOrEqual(2)
  })

  it('exige indicar qué pasó con el dinero recibido', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    expect(() => voidSale(db, yulieth, sale.id, {})).toThrow(/qué ocurrió con ese dinero/)
  })

  it('registra la devolución y deja el ingreso neto en cero', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const voided = voidSale(db, yulieth, sale.id, {
      reason: 'La clienta canceló',
      paymentAction: 'refund',
    })
    expect(voided.status).toBe('voided')
    expect(voided.refunds).toHaveLength(1)
    expect(voided.refunds[0]?.amount).toBe(100_000)
    expect(voided.payments[0]?.status).toBe('valid')

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.payments).toBe(100_000)
    expect(dashboard.received.refunds).toBe(100_000)
    expect(dashboard.received.total).toBe(0)
    expect(dashboard.pending.total).toBe(0)
  })

  it('convierte el dinero retenido en otro ingreso', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Limpieza facial',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const voided = voidSale(db, yulieth, sale.id, {
      reason: 'Se retuvo el abono',
      paymentAction: 'retain',
    })
    expect(voided.status).toBe('voided')

    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.payments).toBe(0)
    expect(dashboard.received.otherIncome).toBe(100_000)
    expect(dashboard.received.total).toBe(100_000)
    expect(dashboard.pending.total).toBe(0)
  })
})

describe('Caso G — dos usuarios sobre los mismos registros', () => {
  it('comparte datos y conserva al autor de cada cambio', () => {
    const { yulieth, fabio } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 200_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, fabio, {
      saleId: sale.id,
      amount: 50_000,
      occurredAt: '2026-10-05 11:00:00',
      method: 'cash',
    })
    updateSale(db, fabio, sale.id, { description: 'Editada por Fabio' })

    const detail = getSaleDetail(db, sale.id)
    expect(detail.payments[0]?.createdByName).toBe('Fabio')
    expect(detail.updatedByName).toBe('Fabio')

    const salesForFabio = listSales(db, { status: 'open' })
    expect(salesForFabio.items).toHaveLength(1)

    const audit = db
      .prepare(
        `SELECT u.name FROM audit_logs a JOIN users u ON u.id = a.user_id
         WHERE a.entity_type = 'sale' AND a.entity_id = ? ORDER BY a.id`,
      )
      .all(sale.id) as Array<{ name: string }>
    expect(audit.some((row) => row.name === 'Yulieth')).toBe(true)
    expect(audit.some((row) => row.name === 'Fabio')).toBe(true)
  })
})

describe('Caso H — precio histórico del catálogo', () => {
  it('no altera ventas anteriores al cambiar el precio del servicio', () => {
    const { yulieth } = setup()
    const serviceId = createTestService(db, yulieth, 'Limpieza facial', 140_000)
    const sale = createSale(db, yulieth, {
      serviceId,
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    updateService(db, yulieth, serviceId, { defaultPrice: 200_000 })

    const detail = getSaleDetail(db, sale.id)
    expect(detail.total).toBe(140_000)
    expect(detail.concept).toBe('Limpieza facial')
    const service = listServices(db)[0]
    expect(service?.defaultPrice).toBe(200_000)
  })
})

describe('Caso I — períodos semanales y mensuales', () => {
  it('usa semanas de lunes a domingo y no duplica pagos entre períodos', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 300_000,
      occurredAt: '2026-10-07 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 09:00:00',
      method: 'cash',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-11 09:00:00',
      method: 'cash',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-12 09:00:00',
      method: 'cash',
    })

    const monday = startOfWeekMonday('2026-10-07')
    const sunday = endOfWeekSunday('2026-10-07')
    expect(monday).toBe('2026-10-05')
    expect(sunday).toBe('2026-10-11')

    const week = getDashboard(db, monday, sunday)
    const month = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(week.received.total).toBe(200_000)
    expect(month.received.total).toBe(300_000)
    expect(week.pending.total).toBe(month.pending.total)
    expect(week.pending.total).toBe(0)
  })

  it('respeta los límites del rango de fechas', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 100_000,
      occurredAt: '2026-10-01 00:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-31 23:59:00',
      method: 'cash',
    })
    expect(getDashboard(db, '2026-10-01', '2026-10-31').received.total).toBe(100_000)
    expect(getDashboard(db, '2026-10-02', '2026-10-31').received.total).toBe(100_000)
    expect(getDashboard(db, '2026-10-01', '2026-10-30').received.total).toBe(0)
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
})

describe('Reglas adicionales', () => {
  it('calcula el pendiente actual aunque la venta sea de otro período', () => {
    const { yulieth } = setup()
    createSale(db, yulieth, {
      concept: 'Servicio viejo',
      total: 90_000,
      occurredAt: '2026-08-10 10:00:00',
    })
    const october = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(october.pending.total).toBe(90_000)
    expect(october.pending.salesCount).toBe(1)
  })

  it('no permite editar una venta por debajo de lo ya pagado', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    expect(() => updateSale(db, yulieth, sale.id, { total: 90_000 })).toThrow(/menor que el dinero/)
  })

  it('excluye pagos anulados de los ingresos', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    const withPayment = createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const paymentId = withPayment.payments[0]?.id
    if (!paymentId) throw new Error('Sin pago')
    voidPayment(db, yulieth, paymentId, 'Pago duplicado')
    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.total).toBe(0)
    expect(dashboard.pending.total).toBe(140_000)
  })

  it('permite devoluciones adicionales hasta el valor del pago', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    const paid = createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 140_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const paymentId = paid.payments[0]?.id
    if (!paymentId) throw new Error('Sin pago')
    voidSale(db, yulieth, sale.id, { paymentAction: 'refund', reason: 'Cancelada' })

    const saleAfter = getSaleDetail(db, sale.id)
    expect(saleAfter.refunds[0]?.amount).toBe(140_000)
    expect(() =>
      createRefund(db, yulieth, sale.id, {
        paymentId,
        amount: 1,
        occurredAt: '2026-10-06 10:00:00',
        method: 'cash',
      }),
    ).toThrow(/supera el valor disponible/)
  })

  it('valida pagos superiores al saldo al editar', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    const paid = createPayment(db, yulieth, {
      saleId: sale.id,
      amount: 100_000,
      occurredAt: '2026-10-05 10:30:00',
      method: 'cash',
    })
    const paymentId = paid.payments[0]?.id
    if (!paymentId) throw new Error('Sin pago')
    expect(() =>
      updatePayment(db, yulieth, paymentId, { amount: 150_000 }),
    ).toThrow(/supera el saldo/)
  })

  it('impide pagos en ventas anuladas', () => {
    const { yulieth } = setup()
    const sale = createSale(db, yulieth, {
      concept: 'Servicio',
      total: 140_000,
      occurredAt: '2026-10-05 10:00:00',
    })
    voidSale(db, yulieth, sale.id, {})
    expect(() =>
      createPayment(db, yulieth, {
        saleId: sale.id,
        amount: 10_000,
        occurredAt: '2026-10-05 11:00:00',
        method: 'cash',
      }),
    ).toThrow(/anulada/)
  })
})

describe('Catálogo y clientes', () => {
  it('evita duplicados evidentes de clientes', () => {
    const { yulieth } = setup()
    createClient(db, yulieth, { name: 'Ana Pérez', phone: '300 123 4567' })
    expect(() => createClient(db, yulieth, { name: 'ana pérez' })).toThrow(/datos similares/)
    expect(() => createClient(db, yulieth, { name: 'Otra', phone: '3001234567' })).toThrow(/datos similares/)
    const allowed = createClient(db, yulieth, { name: 'Ana Pérez', allowDuplicate: true })
    expect(allowed.id).toBeGreaterThan(0)
    expect(listClients(db).total).toBe(2)
  })

  it('mantiene los servicios inactivos visibles para el historial pero no para ventas nuevas', () => {
    const { yulieth } = setup()
    const serviceId = createTestService(db, yulieth)
    updateService(db, yulieth, serviceId, { active: false })
    expect(listServices(db)).toHaveLength(0)
    expect(listServices(db, true)).toHaveLength(1)
    expect(() =>
      createSale(db, yulieth, {
        serviceId,
        total: 140_000,
        occurredAt: '2026-10-05 10:00:00',
      }),
    ).toThrow(/inactivo/)
  })

  it('permite crear categorías y conserva el nombre histórico del gasto', () => {
    const { yulieth } = setup()
    const category = createCategory(db, yulieth, { name: 'Transporte' })
    const expense = createExpense(db, yulieth, {
      amount: 20_000,
      categoryId: category.id,
      occurredAt: '2026-10-05 10:00:00',
    })
    expect(expense.categoryName).toBe('Transporte')
  })
})

describe('Otros ingresos', () => {
  it('suma al dinero recibido y no crea saldo pendiente', () => {
    const { yulieth } = setup()
    createOtherIncome(db, yulieth, {
      amount: 50_000,
      occurredAt: '2026-10-08 10:00:00',
      concept: 'Venta de productos',
    })
    const dashboard = getDashboard(db, '2026-10-01', '2026-10-31')
    expect(dashboard.received.otherIncome).toBe(50_000)
    expect(dashboard.received.total).toBe(50_000)
    expect(dashboard.pending.total).toBe(0)
  })
})
