/**
 * Repositorio de transacciones/reservas (hoja Club) con integración del motor de
 * precios: al crear/editar, se calculan y CONGELAN el precio y el % del profesor
 * (snapshots) usando el catálogo y el curso detectado del cliente.
 */
import { getDb } from '../db/connection'
import type { Transaction } from '@shared/types/domain'
import { autoPrice } from '../services/pricing'
import { detectCourseForClient } from '../services/courses'
import * as catalog from './catalogRepo'

function mapRow(r: any): Transaction {
  return {
    id: r.id,
    txDate: r.tx_date,
    startMin: r.start_min,
    endMin: r.end_min,
    serviceRaw: r.service_raw,
    serviceId: r.service_id,
    isClass: !!r.is_class,
    resolvedServiceId: r.resolved_service_id,
    professorId: r.professor_id,
    clientId: r.client_id,
    kiteId: r.kite_id,
    boardId: r.board_id,
    priceSnapshot: r.price_snapshot,
    professorPctSnapshot: r.professor_pct_snapshot,
    priceOverride: r.price_override,
    comment: r.comment,
    priceEffective: r.price_effective,
    durationMin: r.duration_min,
    professorSalary: r.professor_salary
  }
}

export interface TransactionInput {
  txDate: string
  startMin: number | null
  endMin: number | null
  serviceId: number | null // servicio elegido; null si es "Class"
  isClass: boolean
  clientId: number | null
  professorId: number | null
  kiteId: number | null
  boardId: number | null
  priceOverride: number | null
  comment?: string | null
}

/** Resuelve el servicio (si es "Class", detecta el curso del cliente) y calcula snapshots. */
function computeSnapshots(input: TransactionInput): {
  resolvedServiceId: number | null
  priceSnapshot: number | null
  professorPct: number | null
  serviceRaw: string | null
} {
  let resolvedServiceId = input.serviceId
  if (input.isClass && input.clientId != null) {
    const clientTxs = getDb()
      .prepare('SELECT is_class AS c, duration_min AS d, tx_date FROM transactions WHERE client_id=?')
      .all(input.clientId)
      .map((r: any) => ({ chosenServiceIsClass: !!r.c, durationMin: r.d, txDate: r.tx_date }))
    const course = detectCourseForClient(clientTxs, catalog.courses(), input.txDate)
    resolvedServiceId = course?.id ?? null
  }
  const item = resolvedServiceId != null ? catalog.getService(resolvedServiceId) : null
  const client = input.clientId != null ? getDb().prepare('SELECT discount_pct FROM persons WHERE id=?').get(input.clientId) as { discount_pct: number } | undefined : undefined
  const durationMin = input.endMin != null && input.startMin != null ? input.endMin - input.startMin : null
  let priceSnapshot: number | null = null
  if (item) {
    priceSnapshot = autoPrice({
      item: { hours: item.hours, days: item.days, price: item.price },
      clientDiscountPct: client?.discount_pct ?? 0,
      durationMin
    })
  }
  return {
    resolvedServiceId,
    priceSnapshot,
    professorPct: item?.professorPct ?? null,
    serviceRaw: item?.name ?? null
  }
}

export function create(input: TransactionInput): Transaction {
  const snap = computeSnapshots(input)
  const id = getDb()
    .prepare(
      `INSERT INTO transactions(tx_date,start_min,end_min,service_raw,service_id,is_class,resolved_service_id,
        professor_id,client_id,kite_id,board_id,price_snapshot,professor_pct_snapshot,price_override,comment)
       VALUES(@date,@start,@end,@raw,@serviceId,@isClass,@resolved,@prof,@client,@kite,@board,@price,@pct,@override,@comment)`
    )
    .run({
      date: input.txDate, start: input.startMin, end: input.endMin, raw: snap.serviceRaw,
      serviceId: input.serviceId, isClass: input.isClass ? 1 : 0, resolved: snap.resolvedServiceId,
      prof: input.professorId, client: input.clientId, kite: input.kiteId, board: input.boardId,
      price: snap.priceSnapshot, pct: snap.professorPct, override: input.priceOverride,
      comment: input.comment ?? null
    }).lastInsertRowid as number
  return get(id)!
}

export function get(id: number): Transaction | null {
  const r = getDb().prepare('SELECT * FROM transactions WHERE id=?').get(id)
  return r ? mapRow(r) : null
}

export interface TxFilter {
  clientId?: number
  professorId?: number
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export function list(filter: TxFilter = {}): Transaction[] {
  const where: string[] = []
  const p: any = {}
  if (filter.clientId) { where.push('client_id=@clientId'); p.clientId = filter.clientId }
  if (filter.professorId) { where.push('professor_id=@professorId'); p.professorId = filter.professorId }
  if (filter.from) { where.push('tx_date>=@from'); p.from = filter.from }
  if (filter.to) { where.push('tx_date<=@to'); p.to = filter.to }
  const sql =
    'SELECT * FROM transactions' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY tx_date DESC, id DESC' +
    (filter.limit ? ` LIMIT ${Number(filter.limit)} OFFSET ${Number(filter.offset || 0)}` : '')
  return getDb().prepare(sql).all(p).map(mapRow)
}

export function remove(id: number): void {
  getDb().prepare('DELETE FROM transactions WHERE id=?').run(id)
}
