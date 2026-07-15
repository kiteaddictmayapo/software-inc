/** Exportación de reportes a Excel (.xlsx) con exceljs. */
import ExcelJS from 'exceljs'
import { join } from 'node:path'
import { getPaths } from '../paths'
import * as finance from '../repositories/financeRepo'

function outFile(name: string): string {
  return join(getPaths().exportsDir, name)
}

/** Exporta el balance diario a un .xlsx. */
export async function exportBalance(from?: string, to?: string): Promise<string> {
  const { rows, totals } = finance.dailyCashflow(from, to)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Balance')
  ws.columns = [
    { header: 'Fecha', key: 'date', width: 14 },
    { header: 'Ingresos clientes', key: 'inClients', width: 18, style: { numFmt: '#,##0' } },
    { header: 'Ingresos bar', key: 'inBar', width: 16, style: { numFmt: '#,##0' } },
    { header: 'IN', key: 'in', width: 16, style: { numFmt: '#,##0' } },
    { header: 'OUT', key: 'out', width: 16, style: { numFmt: '#,##0' } },
    { header: 'Saldo acumulado', key: 'runningBalance', width: 18, style: { numFmt: '#,##0' } }
  ]
  ws.getRow(1).font = { bold: true }
  rows.forEach((r) => ws.addRow(r))
  ws.addRow({})
  ws.addRow({ date: 'TOTAL', in: totals.in, out: totals.out, runningBalance: totals.net }).font = { bold: true }
  const path = outFile(`balance-${from ?? 'inicio'}_${to ?? 'hoy'}.xlsx`)
  await wb.xlsx.writeFile(path)
  return path
}

/** Exporta el resumen mensual (P&L) a un .xlsx. */
export async function exportMonthSummary(year: number, month: number): Promise<string> {
  const s = finance.monthSummary(year, month)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Resumen ${year}-${String(month).padStart(2, '0')}`)
  ws.addRow(['Resumen mensual', `${year}-${String(month).padStart(2, '0')}`]).font = { bold: true }
  ws.addRow([])
  ws.addRow(['Ingresos de clientes', s.incomeClients])
  ws.addRow(['Gastos (no profesores)', s.expensesNonProfessor])
  ws.addRow([])
  ws.addRow(['Salarios por profesor']).font = { bold: true }
  s.professorSalaries.forEach((p) => ws.addRow([p.name, p.amount]))
  ws.addRow([])
  ws.addRow(['Costo total', s.totalCosts]).font = { bold: true }
  ws.addRow(['Neto', s.net]).font = { bold: true }
  ws.getColumn(2).numFmt = '#,##0'
  ws.getColumn(1).width = 32
  ws.getColumn(2).width = 18
  const path = outFile(`resumen-${year}-${String(month).padStart(2, '0')}.xlsx`)
  await wb.xlsx.writeFile(path)
  return path
}
