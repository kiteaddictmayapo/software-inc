/**
 * API simulado para el MODO DEMO (navegador, sin Electron).
 * Implementa el contrato AppApi calculando sobre datos de ejemplo en memoria,
 * con las mismas fórmulas de la app real (precios, factura, liquidación, balance).
 * Las mutaciones se pierden al recargar la página (es un demo).
 */
import type { AppApi } from '@shared/types/api'
import type { Person } from '@shared/types/domain'
import * as sample from './sampleData'

const persons: Person[] = sample.persons.map((p) => ({ ...p }))
const services = sample.services.map((s) => ({ ...s }))
const equipment = sample.equipment.map((e) => ({ ...e }))
const transactions = sample.transactions.map((t) => ({ ...t }))
const barProducts = sample.barProducts.map((p) => ({ ...p }))
const barSales = sample.barSales.map((s) => ({ ...s }))
const expenses = sample.expenses.map((e) => ({ ...e }))
const plans = sample.paymentPlans.map((p) => ({ ...p, installments: p.installments.map((i) => ({ ...i })) }))

let nextId = 1000
const roundCOP = (n: number) => Math.round(n)
const monthOf = (iso: string) => iso.slice(0, 7)
const notAvailable = async (): Promise<any> => {
  alert('Esta función (PDF / Excel / correo / respaldo) está disponible en la app instalada.')
  return ''
}

export const mockApi: AppApi = {
  auth: {
    status: async () => ({ hasPin: true, needsImport: false, schemaVersion: 1, userDataPath: '(demo)' }),
    hasPin: async () => true,
    setPin: async () => ({ ok: true }),
    verify: async () => ({ ok: true }),
    change: async () => ({ ok: true })
  },
  import: {
    pickFile: async () => null,
    run: async () => ({ batchId: 0, sourceFile: '(demo)', counts: {}, rowsOk: 0, rowsError: 0, errors: [], durationMs: 0 })
  },
  persons: {
    list: async (filter) => {
      let r = persons
      if (filter?.role === 'client') r = r.filter((p) => p.isClient)
      if (filter?.role === 'professor') r = r.filter((p) => p.isProfessor)
      if (filter?.role === 'supplier') r = r.filter((p) => p.isSupplier)
      if (filter?.onlyActive) r = r.filter((p) => p.stillHere)
      if (filter?.search) {
        const q = filter.search.toLowerCase()
        r = r.filter((p) => p.fullName.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q))
      }
      return r.map((p) => ({ ...p }))
    },
    count: async (filter) => (await mockApi.persons.list(filter)).length,
    get: async (id) => persons.find((p) => p.id === id) ?? null,
    create: async (input) => {
      const p: Person = { ...(input as any), id: ++nextId, photoThumbPath: null }
      persons.push(p)
      return p
    },
    update: async (id, input) => {
      const i = persons.findIndex((p) => p.id === id)
      if (i >= 0) persons[i] = { ...persons[i], ...(input as any), id }
      return persons[i]
    },
    remove: async (id) => {
      const i = persons.findIndex((p) => p.id === id)
      if (i >= 0) persons.splice(i, 1)
    },
    setPhoto: async () => ({ photoPath: '(demo)', photoThumbPath: '(demo)' }),
    photoDataUrl: async () => null
  },
  catalog: {
    listServices: async () => services.map((s) => ({ ...s })),
    createService: async (s) => {
      const item = { ...(s as any), id: ++nextId }
      services.push(item)
      return item
    },
    updateService: async (id, s) => {
      const i = services.findIndex((x) => x.id === id)
      if (i >= 0) services[i] = { ...(s as any), id }
      return services[i]
    },
    listEquipment: async () => equipment.map((e) => ({ ...e }))
  },
  transactions: {
    list: async (filter) => {
      let r = transactions
      if (filter?.clientId) r = r.filter((t) => t.clientId === filter.clientId)
      if (filter?.professorId) r = r.filter((t) => t.professorId === filter.professorId)
      return r.map((t) => ({ ...t })).sort((a, b) => b.txDate.localeCompare(a.txDate))
    },
    create: async (input: any) => {
      const svc = services.find((s) => s.id === input.serviceId)
      const client = persons.find((p) => p.id === input.clientId)
      const durationMin = input.endMin != null && input.startMin != null ? input.endMin - input.startMin : null
      let price = input.priceOverride ?? null
      if (price == null && svc && durationMin != null) {
        const factor = (100 - (client?.discountPct ?? 0)) / 100
        price = svc.days > 0 ? roundCOP((factor * svc.price) / svc.days) : roundCOP(factor * (durationMin / 60 / svc.hours) * svc.price)
      }
      const salary = svc && price != null ? roundCOP(price * svc.professorPct) : 0
      const t = {
        id: ++nextId, txDate: input.txDate, startMin: input.startMin, endMin: input.endMin,
        serviceRaw: svc?.name ?? null, serviceId: input.serviceId, isClass: !!input.isClass,
        resolvedServiceId: input.serviceId, professorId: input.professorId, clientId: input.clientId,
        kiteId: input.kiteId, boardId: input.boardId, priceSnapshot: price, professorPctSnapshot: svc?.professorPct ?? null,
        priceOverride: input.priceOverride, comment: input.comment ?? null,
        priceEffective: price, durationMin, professorSalary: salary
      }
      transactions.push(t as any)
      return t as any
    },
    remove: async (id) => {
      const i = transactions.findIndex((t) => t.id === id)
      if (i >= 0) transactions.splice(i, 1)
    }
  },
  bar: {
    listProducts: async () =>
      barProducts.map((p) => {
        const purchased = expenses.filter((e) => e.supplyName === p.name).reduce((a, b) => a + (b.count || 0), 0)
        const sold = barSales.filter((s) => s.productId === p.id).reduce((a, b) => a + (b.qty || 0), 0)
        return { ...p, stock: purchased - sold }
      }),
    createSale: async (input: any) => {
      const p = barProducts.find((x) => x.id === input.productId)!
      const total = roundCOP(input.qty * (p.sellPrice ?? 0))
      const s = { id: ++nextId, saleDate: input.saleDate, clientId: input.clientId ?? null, clientRaw: null, productId: input.productId, productRaw: p.name, qty: input.qty, total, paidCash: !!input.paidCash, alreadyPaid: !!input.alreadyPaid }
      barSales.push(s)
      return s
    },
    listSales: async () => barSales.map((s) => ({ ...s })).sort((a, b) => b.saleDate.localeCompare(a.saleDate))
  },
  expenses: {
    list: async () => expenses.map((e) => ({ ...e })).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    create: async (input: any) => {
      const e = { id: ++nextId, expenseDate: input.expenseDate, supplyName: input.supplyName, count: input.count ?? 1, areaName: null, areaPersonId: input.areaPersonId ?? null, supplierId: null, supplierRaw: null, amountOut: roundCOP(input.amountOut), comment: input.comment ?? null }
      expenses.push(e)
      return e
    },
    remove: async (id) => {
      const i = expenses.findIndex((e) => e.id === id)
      if (i >= 0) expenses.splice(i, 1)
    }
  },
  bills: {
    preview: async (clientId, opts = {}) => buildBill(clientId, opts),
    save: async (clientId, opts = {}) => {
      const b = buildBill(clientId, opts)
      return { id: ++nextId, clientId, billDate: opts.billDate ?? new Date().toISOString().slice(0, 10), lodgingDays: 0, lodgingRate: 0, discountPct: opts.discountPct ?? 0, deductions: opts.deduction ?? 0, alreadyPaid: b.result.alreadyPaid, cardSurcharge: !!opts.cardSurcharge, subtotal: b.result.subtotal, total: b.result.total, netToPay: b.result.netToPay, status: 'issued', pdfPath: null, emailedAt: null, notes: null, items: b.items }
    },
    pdf: notAvailable,
    email: async () => ({ ok: false, error: 'Disponible en la app instalada.' })
  },
  settlements: {
    preview: async (professorId, year, month) => buildSettlement(professorId, year, month),
    save: async (professorId, year, month) => {
      const s = buildSettlement(professorId, year, month)
      return { id: ++nextId, professorId, periodYear: year, periodMonth: month, grossSalary: s.result.gross, barDiscount: s.result.barDiscount, expensesAssigned: 0, netAmount: s.result.net, status: 'issued', pdfPath: null, emailedAt: null }
    },
    pdf: notAvailable
  },
  finance: {
    dailyCashflow: async () => {
      const days: Record<string, { date: string; inClients: number; inBar: number; out: number }> = {}
      const touch = (d: string) => (days[d] ??= { date: d, inClients: 0, inBar: 0, out: 0 })
      transactions.forEach((t) => (touch(t.txDate).inClients += t.priceEffective ?? 0))
      barSales.forEach((s) => (touch(s.saleDate).inBar += s.total))
      expenses.forEach((e) => (touch(e.expenseDate).out += e.amountOut))
      const sorted = Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
      let running = 0
      const rows = sorted.map((d) => {
        const inSum = d.inClients + d.inBar
        running += inSum - d.out
        return { date: d.date, inClients: d.inClients, inBar: d.inBar, in: inSum, out: d.out, runningBalance: running }
      })
      const totals = rows.reduce((a, r) => ({ in: a.in + r.in, out: a.out + r.out, net: 0 }), { in: 0, out: 0, net: 0 })
      totals.net = totals.in - totals.out
      return { rows, totals }
    },
    monthSummary: async (year, month) => {
      const prefix = `${year}-${String(month).padStart(2, '0')}`
      const incomeClients =
        transactions.filter((t) => monthOf(t.txDate) === prefix).reduce((a, b) => a + (b.priceEffective ?? 0), 0) +
        barSales.filter((s) => monthOf(s.saleDate) === prefix).reduce((a, b) => a + b.total, 0)
      const professorSalaries = professorsWithSalary(prefix)
      const salariesTotal = professorSalaries.reduce((a, b) => a + b.amount, 0)
      const expensesNonProfessor = expenses
        .filter((e) => monthOf(e.expenseDate) === prefix && !isProfessor(e.areaPersonId))
        .reduce((a, b) => a + b.amountOut, 0)
      const totalCosts = expensesNonProfessor + salariesTotal
      return { year, month, incomeClients, expensesNonProfessor, professorSalaries, totalCosts, net: incomeClients - totalCosts }
    },
    ageStats: async () => {
      const counts = new Map<number, number>()
      const today = new Date().toISOString().slice(0, 10)
      persons.forEach((p) => {
        if (!p.birthDate) return
        const years = (Date.parse(p.checkIn || today) - Date.parse(p.birthDate)) / (365 * 86400000)
        if (years < 0 || years > 120) return
        const b = Math.floor(years) - (Math.floor(years) % 5)
        counts.set(b, (counts.get(b) || 0) + 1)
      })
      return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, count]) => ({ bucket, count }))
    },
    yearBalance: async () => {
      const map = new Map<number, { in: number; out: number }>()
      const touch = (y: number) => (map.get(y) ?? map.set(y, { in: 0, out: 0 }).get(y)!)
      transactions.forEach((t) => (touch(+t.txDate.slice(0, 4)).in += t.priceEffective ?? 0))
      barSales.forEach((s) => (touch(+s.saleDate.slice(0, 4)).in += s.total))
      expenses.forEach((e) => (touch(+e.expenseDate.slice(0, 4)).out += e.amountOut))
      return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, in: v.in, out: v.out }))
    },
    dashboard: async () => ({
      clients: persons.filter((p) => p.isClient).length,
      professors: persons.filter((p) => p.isProfessor).length,
      transactions: transactions.length,
      incomeAll: transactions.reduce((a, b) => a + (b.priceEffective ?? 0), 0),
      expensesAll: expenses.reduce((a, b) => a + b.amountOut, 0),
      barSales: barSales.length
    })
  },
  plans: {
    list: async () => plans.map((p) => ({ ...p, outstanding: outstanding(p) })),
    get: async (id) => {
      const p = plans.find((x) => x.id === id)
      if (!p) return null
      let bal = p.principal
      const installments = p.installments.map((i) => {
        bal -= i.amount
        return { ...i, balanceAfter: bal }
      })
      return { ...p, installments, outstanding: bal }
    },
    create: async (title, personId, principal) => {
      const p = { id: ++nextId, title, personId, equipmentId: null, principal, startDate: null, status: 'active' as const, installments: [] }
      plans.push(p)
      return { ...p, outstanding: principal }
    },
    addInstallment: async (planId, paidDate, amount) => {
      const p = plans.find((x) => x.id === planId)!
      p.installments.push({ id: ++nextId, planId, paidDate, amount, comment: null })
      return { ...p, outstanding: outstanding(p) }
    }
  },
  settings: {
    getCompany: async () => ({ companyName: 'Escuela de Deportes Acuáticos (DEMO)', companyNit: '', cardSurchargePct: 0.05, currency: 'COP' }),
    setCompany: async () => undefined,
    getSmtp: async () => ({ host: '', port: 587, user: '', from: '', hasPassword: false }),
    setSmtp: async () => undefined,
    testSmtp: async () => ({ ok: false, error: 'Disponible en la app instalada.' }),
    setBarDiscount: async () => undefined,
    getBarDiscount: async () => 0
  },
  backup: { create: notAvailable, list: async () => [] },
  exports: { balance: notAvailable, monthSummary: notAvailable, openFolder: async () => undefined }
}

// ---- helpers de cálculo ----
function isProfessor(id: number | null): boolean {
  return !!persons.find((p) => p.id === id)?.isProfessor
}
function professorsWithSalary(prefix: string) {
  const map = new Map<number, number>()
  transactions.filter((t) => monthOf(t.txDate) === prefix && t.professorId).forEach((t) => {
    map.set(t.professorId!, (map.get(t.professorId!) || 0) + (t.professorSalary ?? 0))
  })
  return [...map.entries()].map(([professorId, amount]) => ({ professorId, name: persons.find((p) => p.id === professorId)?.fullName ?? '', amount })).sort((a, b) => b.amount - a.amount)
}
function outstanding(p: { principal: number; installments: { amount: number }[] }): number {
  return p.principal - p.installments.reduce((a, b) => a + b.amount, 0)
}
function buildBill(clientId: number, opts: any) {
  const client = persons.find((p) => p.id === clientId)!
  const txs = transactions.filter((t) => t.clientId === clientId)
  const sales = barSales.filter((s) => s.clientId === clientId)
  const items = [
    ...txs.map((t) => ({ kind: 'service' as const, transactionId: t.id, description: `${t.serviceRaw ?? 'Servicio'} (${t.txDate})`, qty: 1, unitPrice: t.priceEffective ?? 0, lineTotal: t.priceEffective ?? 0 })),
    ...sales.map((s) => ({ kind: 'bar' as const, barSaleId: s.id, description: `Bar: ${s.productRaw} x${s.qty} (${s.saleDate})`, qty: s.qty, unitPrice: s.qty ? Math.round(s.total / s.qty) : s.total, lineTotal: s.total }))
  ]
  const sumServices = txs.reduce((a, b) => a + (b.priceEffective ?? 0), 0)
  const subtotal = sumServices === 0 ? 0 : roundCOP((sumServices * (100 - (opts.discountPct || 0))) / 100 - (opts.deduction || 0))
  const barTotal = sales.reduce((a, b) => a + b.total, 0)
  const lodging = roundCOP((opts.lodgingDays || 0) * (opts.lodgingRate || 0))
  const total = subtotal + lodging + barTotal
  const alreadyPaid = opts.alreadyPaid ?? client.paid ?? 0
  const netToPay = total - alreadyPaid
  const cardTotal = opts.cardSurcharge ? roundCOP(netToPay * 1.05) : netToPay
  return { clientId, clientName: client.fullName, items, result: { sumServices, subtotal, lodging, barTotal, total, alreadyPaid, netToPay, cardTotal }, options: opts }
}
function buildSettlement(professorId: number, year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const prof = persons.find((p) => p.id === professorId)!
  const rows = transactions.filter((t) => t.professorId === professorId && monthOf(t.txDate) === prefix)
  const salaryRows = rows.map((t) => ({ date: t.txDate, service: t.serviceRaw, client: persons.find((p) => p.id === t.clientId)?.fullName ?? null, salary: t.professorSalary ?? 0 }))
  const gross = salaryRows.reduce((a, b) => a + b.salary, 0)
  return { professorId, professorName: prof.fullName, year, month, salaryRows, outcomeRows: [], result: { gross, barDiscount: 0, expenses: 0, installments: 0, net: gross } }
}
