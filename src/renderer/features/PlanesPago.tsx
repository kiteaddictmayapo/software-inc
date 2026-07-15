import React, { useState } from 'react'
import { api, useAsync, formatCOP, todayISO } from '../lib/api'
import { Modal, Field, Spinner, Empty } from '../components/ui'

export function PlanesPago() {
  const { data, loading, reload } = useAsync(() => api.plans.list(), [])
  const persons = useAsync(() => api.persons.list({ limit: 2000 }), [])
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  return (
    <div>
      <div className="header">
        <h1>Planes de pago</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nuevo plan</button>
      </div>
      <div className="panel">
        {loading ? <div style={{ padding: 24 }}><Spinner /></div> : !data?.length ? <Empty>Sin planes de pago.</Empty> : (
          <table className="data">
            <thead><tr><th>Concepto</th><th className="num">Saldo inicial</th><th className="num">Saldo pendiente</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td className="num">{formatCOP(p.principal)}</td>
                  <td className="num">{formatCOP(p.outstanding)}</td>
                  <td><span className={`badge ${p.status === 'settled' ? 'ok' : 'role'}`}>{p.status === 'settled' ? 'Saldado' : 'Activo'}</span></td>
                  <td><button className="btn ghost" onClick={() => setDetailId(p.id)}>Ver abonos</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <PlanForm persons={persons.data ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload() }} />
      )}
      {detailId && <PlanDetail planId={detailId} onClose={() => { setDetailId(null); reload() }} />}
    </div>
  )
}

function PlanForm({ persons, onClose, onSaved }: any) {
  const [form, setForm] = useState({ title: '', personId: '', principal: 0, startDate: todayISO() })
  const [busy, setBusy] = useState(false)
  const set = (p: any) => setForm((f) => ({ ...f, ...p }))
  async function save() {
    setBusy(true)
    try {
      await api.plans.create(form.title, form.personId ? Number(form.personId) : null, Number(form.principal), form.startDate)
      onSaved()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Nuevo plan de pago" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Crear'}</button></>}>
      <Field label="Concepto (p.ej. cometa switch blade 10)"><input value={form.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <div className="row2">
        <Field label="Deudor">
          <select value={form.personId} onChange={(e) => set({ personId: e.target.value })}>
            <option value="">—</option>
            {persons.map((p: any) => <option key={p.id} value={p.id}>{p.nickname || p.fullName}</option>)}
          </select>
        </Field>
        <Field label="Saldo inicial (COP)"><input type="number" value={form.principal} onChange={(e) => set({ principal: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  )
}

function PlanDetail({ planId, onClose }: { planId: number; onClose: () => void }) {
  const { data, loading, reload } = useAsync(() => api.plans.get(planId), [planId])
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  async function add() {
    setBusy(true)
    try {
      await api.plans.addInstallment(planId, date, amount, null)
      setAmount(0)
      reload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={data ? data.title : 'Plan'} onClose={onClose} footer={<button className="btn" onClick={onClose}>Cerrar</button>}>
      {loading || !data ? <Spinner /> : (
        <div>
          <p>Saldo inicial: <strong>{formatCOP(data.principal)}</strong> · Pendiente: <strong>{formatCOP(data.outstanding)}</strong></p>
          <table className="data">
            <thead><tr><th>Fecha</th><th className="num">Abono</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {data.installments?.map((i) => <tr key={i.id}><td>{i.paidDate}</td><td className="num">{formatCOP(i.amount)}</td><td className="num">{formatCOP(i.balanceAfter)}</td></tr>)}
            </tbody>
          </table>
          <div className="toolbar" style={{ marginTop: 14 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
            <input type="number" placeholder="Abono" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} style={{ width: 160 }} />
            <button className="btn primary" onClick={add} disabled={busy || !amount}>Agregar abono</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
