import React, { useState } from 'react'
import { api, useAsync, formatCOP, todayISO } from '../lib/api'
import { Modal, Field, Spinner, Empty } from '../components/ui'

export function Gastos() {
  const [creating, setCreating] = useState(false)
  const { data, loading, reload } = useAsync(() => api.expenses.list(), [])
  const persons = useAsync(() => api.persons.list({ limit: 2000 }), [])

  return (
    <div>
      <div className="header">
        <h1>Gastos</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nuevo gasto</button>
      </div>
      <div className="panel">
        {loading ? <div style={{ padding: 24 }}><Spinner /></div> : !data?.length ? <Empty>Sin gastos.</Empty> : (
          <table className="data">
            <thead><tr><th>Fecha</th><th>Insumo</th><th>Área/Nombre</th><th>Proveedor</th><th>Comentario</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{e.expenseDate}</td>
                  <td>{e.supplyName ?? '—'}</td>
                  <td>{e.areaName ?? '—'}</td>
                  <td>{e.supplierRaw ?? '—'}</td>
                  <td className="muted">{e.comment ?? ''}</td>
                  <td className="num">{formatCOP(e.amountOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <ExpenseForm
          persons={persons.data ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload() }}
        />
      )}
    </div>
  )
}

function ExpenseForm({ persons, onClose, onSaved }: any) {
  const [form, setForm] = useState({ expenseDate: todayISO(), supplyName: '', count: 1, areaPersonId: '', amountOut: 0, comment: '' })
  const [busy, setBusy] = useState(false)
  const set = (p: any) => setForm((f) => ({ ...f, ...p }))
  const staff = persons.filter((p: any) => p.isProfessor || p.isSupplier)

  async function save() {
    setBusy(true)
    try {
      await api.expenses.create({
        expenseDate: form.expenseDate,
        supplyName: form.supplyName || null,
        count: Number(form.count) || 1,
        areaName: null,
        areaPersonId: form.areaPersonId ? Number(form.areaPersonId) : null,
        supplierId: null,
        amountOut: Number(form.amountOut),
        comment: form.comment || null
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuevo gasto" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Guardar'}</button></>}>
      <div className="row2">
        <Field label="Fecha"><input type="date" value={form.expenseDate} onChange={(e) => set({ expenseDate: e.target.value })} /></Field>
        <Field label="Monto (COP)"><input type="number" value={form.amountOut} onChange={(e) => set({ amountOut: Number(e.target.value) })} /></Field>
      </div>
      <div className="row2">
        <Field label="Insumo"><input value={form.supplyName} onChange={(e) => set({ supplyName: e.target.value })} /></Field>
        <Field label="Cantidad"><input type="number" value={form.count} onChange={(e) => set({ count: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Asignado a (profesor/área)">
        <select value={form.areaPersonId} onChange={(e) => set({ areaPersonId: e.target.value })}>
          <option value="">— (gasto general de la escuela)</option>
          {staff.map((p: any) => <option key={p.id} value={p.id}>{p.nickname || p.fullName}</option>)}
        </select>
      </Field>
      <Field label="Comentario"><input value={form.comment} onChange={(e) => set({ comment: e.target.value })} /></Field>
    </Modal>
  )
}
