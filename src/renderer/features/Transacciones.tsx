import React, { useState } from 'react'
import { api, useAsync, formatCOP, minutesToHHMM, hhmmToMinutes, todayISO } from '../lib/api'
import { Modal, Field, Spinner, Empty } from '../components/ui'

export function Transacciones() {
  const [creating, setCreating] = useState(false)
  const { data, loading, reload } = useAsync(() => api.transactions.list({ limit: 300 }), [])
  const persons = useAsync(() => api.persons.list({ limit: 2000 }), [])
  const services = useAsync(() => api.catalog.listServices(true), [])
  const equipment = useAsync(() => api.catalog.listEquipment(true), [])

  const nameOf = (id: number | null) => persons.data?.find((p) => p.id === id)?.fullName ?? '—'
  const svcOf = (id: number | null) => services.data?.find((s) => s.id === id)?.name ?? null

  return (
    <div>
      <div className="header">
        <h1>Transacciones / Reservas</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nueva reserva</button>
      </div>
      <div className="panel">
        {loading ? (
          <div style={{ padding: 24 }}><Spinner /></div>
        ) : !data?.length ? (
          <Empty>Sin transacciones.</Empty>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Servicio</th>
                <th>Cliente</th>
                <th>Profesor</th>
                <th className="num">Precio</th>
                <th className="num">Salario prof.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td>{t.txDate}</td>
                  <td>{t.startMin != null ? `${minutesToHHMM(t.startMin)}–${minutesToHHMM(t.endMin)}` : '—'}</td>
                  <td>{t.isClass ? <span className="badge role">Clase</span> : ''} {svcOf(t.resolvedServiceId ?? t.serviceId) ?? t.serviceRaw ?? '—'}</td>
                  <td>{nameOf(t.clientId)}</td>
                  <td>{nameOf(t.professorId)}</td>
                  <td className="num">{formatCOP(t.priceEffective)}</td>
                  <td className="num">{formatCOP(t.professorSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && persons.data && services.data && (
        <TxForm
          persons={persons.data}
          services={services.data}
          equipment={equipment.data ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TxForm({ persons, services, equipment, onClose, onSaved }: any) {
  const clients = persons.filter((p: any) => p.isClient)
  const professors = persons.filter((p: any) => p.isProfessor)
  const [form, setForm] = useState({
    txDate: todayISO(),
    start: '08:00',
    end: '09:00',
    serviceId: '' as string,
    isClass: false,
    clientId: '' as string,
    professorId: '' as string,
    kiteId: '' as string,
    boardId: '' as string,
    priceOverride: '' as string
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (p: any) => setForm((f) => ({ ...f, ...p }))

  async function save() {
    setErr(null)
    const startMin = hhmmToMinutes(form.start)
    const endMin = hhmmToMinutes(form.end)
    if (startMin != null && endMin != null && endMin <= startMin) return setErr('La hora de fin debe ser mayor que la de inicio.')
    setBusy(true)
    try {
      await api.transactions.create({
        txDate: form.txDate,
        startMin,
        endMin,
        serviceId: form.isClass ? null : form.serviceId ? Number(form.serviceId) : null,
        isClass: form.isClass,
        clientId: form.clientId ? Number(form.clientId) : null,
        professorId: form.professorId ? Number(form.professorId) : null,
        kiteId: form.kiteId ? Number(form.kiteId) : null,
        boardId: form.boardId ? Number(form.boardId) : null,
        priceOverride: form.priceOverride ? Number(form.priceOverride) : null
      })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Nueva reserva"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Guardar'}</button>
        </>
      }
    >
      <div className="row3">
        <Field label="Fecha"><input type="date" value={form.txDate} onChange={(e) => set({ txDate: e.target.value })} /></Field>
        <Field label="Hora inicio"><input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Hora fin"><input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
      <div className="row2">
        <Field label="Cliente">
          <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
            <option value="">—</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </Field>
        <Field label="Profesor">
          <select value={form.professorId} onChange={(e) => set({ professorId: e.target.value })}>
            <option value="">—</option>
            {professors.map((p: any) => <option key={p.id} value={p.id}>{p.nickname || p.fullName}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={form.isClass} onChange={(e) => set({ isClass: e.target.checked })} /> Es una clase (el curso se detecta según las horas acumuladas del cliente)</label>
      </div>
      {!form.isClass && (
        <Field label="Servicio">
          <select value={form.serviceId} onChange={(e) => set({ serviceId: e.target.value })}>
            <option value="">—</option>
            {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} · {formatCOP(s.price)}</option>)}
          </select>
        </Field>
      )}
      <div className="row3">
        <Field label="Kite">
          <select value={form.kiteId} onChange={(e) => set({ kiteId: e.target.value })}>
            <option value="">—</option>
            {equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </select>
        </Field>
        <Field label="Tabla">
          <select value={form.boardId} onChange={(e) => set({ boardId: e.target.value })}>
            <option value="">—</option>
            {equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </select>
        </Field>
        <Field label="Precio manual (opcional)">
          <input type="number" value={form.priceOverride} onChange={(e) => set({ priceOverride: e.target.value })} placeholder="Auto" />
        </Field>
      </div>
      {err && <div className="err">{err}</div>}
      <p className="muted">El precio y el salario del profesor se calculan automáticamente con el catálogo y el descuento del cliente.</p>
    </Modal>
  )
}
