/**
 * CLI de importación (verificación y uso manual).
 *
 *   tsx src/main/services/importCli.ts <ruta.xlsx> [ruta.db]
 *
 * Crea/usa una BD SQLite, aplica migraciones e importa el Excel, imprimiendo
 * un reporte de conteos y errores. No depende de Electron.
 */
import { openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { importWorkbook } from './importer'

async function main() {
  const xlsx = process.argv[2]
  const dbPath = process.argv[3] || ':memory:'
  if (!xlsx) {
    console.error('Uso: tsx importCli.ts <ruta.xlsx> [ruta.db]')
    process.exit(1)
  }
  const db = openDatabase(dbPath)
  const version = runMigrations(db)
  console.log(`Esquema en versión ${version}`)

  const report = await importWorkbook(db, xlsx, { force: true })

  console.log('\n=== REPORTE DE IMPORTACIÓN ===')
  console.log('Archivo:', report.sourceFile)
  console.log('Batch:', report.batchId, '| duración:', report.durationMs, 'ms')
  console.log('\nConteos por entidad:')
  for (const [k, v] of Object.entries(report.counts)) console.log(`  ${k.padEnd(22)} ${v}`)
  console.log(`\nFilas OK: ${report.rowsOk} | Filas con aviso/error: ${report.rowsError}`)

  // Agrupar errores por razón
  const byReason = new Map<string, number>()
  for (const e of report.errors) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1)
  if (byReason.size) {
    console.log('\nAvisos/errores por razón:')
    for (const [r, c] of byReason) console.log(`  ${r.padEnd(28)} ${c}`)
  }

  // Verificaciones cruzadas contra la BD
  console.log('\n=== VERIFICACIÓN EN BD ===')
  const q = (sql: string) => (db.prepare(sql).get() as { c: number }).c
  console.log('persons total:            ', q('SELECT COUNT(*) c FROM persons'))
  console.log('  clientes:               ', q('SELECT COUNT(*) c FROM persons WHERE is_client=1'))
  console.log('  profesores:             ', q('SELECT COUNT(*) c FROM persons WHERE is_professor=1'))
  console.log('  proveedores:            ', q('SELECT COUNT(*) c FROM persons WHERE is_supplier=1'))
  console.log('service_catalog:          ', q('SELECT COUNT(*) c FROM service_catalog'))
  console.log('equipment:                ', q('SELECT COUNT(*) c FROM equipment'))
  console.log('bar_products:             ', q('SELECT COUNT(*) c FROM bar_products'))
  console.log('transactions:             ', q('SELECT COUNT(*) c FROM transactions'))
  console.log('  con profesor asignado:  ', q('SELECT COUNT(*) c FROM transactions WHERE professor_id IS NOT NULL'))
  console.log('  con cliente asignado:   ', q('SELECT COUNT(*) c FROM transactions WHERE client_id IS NOT NULL'))
  console.log('expenses:                 ', q('SELECT COUNT(*) c FROM expenses'))
  console.log('bar_sales:                ', q('SELECT COUNT(*) c FROM bar_sales'))
  console.log('payment_plans:            ', q('SELECT COUNT(*) c FROM payment_plans'))
  console.log('payment_installments:     ', q('SELECT COUNT(*) c FROM payment_plan_installments'))

  const salTotal = db.prepare('SELECT SUM(professor_salary) s FROM transactions').get() as { s: number }
  console.log('\nSuma de salarios de profesores (col M):', salTotal.s)
  const priceTotal = db.prepare('SELECT SUM(price_effective) s FROM transactions').get() as { s: number }
  console.log('Suma de precios efectivos (col J/K):   ', priceTotal.s)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
