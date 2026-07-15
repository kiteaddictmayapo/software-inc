import React, { useState } from 'react'
import { api, useAsync, formatCOP } from '../lib/api'
import { Modal, Field, Spinner, Empty } from '../components/ui'
import type { ServiceCatalogItem } from '@shared/types/domain'

const EMPTY: Omit<ServiceCatalogItem, 'id'> = {
  name: '',
  discipline: null,
  seasonYear: null,
  hours: 1,
  days: 0,
  price: 0,
  professorPct: 0,
  isClass: false,
  active: true
}

export function Catalogo() {
  const [tab, setTab] = useState<'services' | 'equipment'>('services')
  const [editing, setEditing] = useState<ServiceCatalogItem | 'new' | null>(null)
  const services = useAsync(() => api.catalog.listServices(false), [])
  const equipment = useAsync(() => api.catalog.listEquipment(false), [])

  return (
    <div>
      <div className="header">
        <h1>Catálogo</h1>
        {tab === 'services' && (
          <button className="btn primary" onClick={() => setEditing('new')}>
            + Nuevo servicio
          </button>
        )}
      </div>
      <div className="toolbar">
        <button className={`btn ${tab === 'services' ? 'primary' : ''}`} onClick={() => setTab('services')}>
          Servicios y precios
        </button>
        <button className={`btn ${tab === 'equipment' ? 'primary' : ''}`} onClick={() => setTab('equipment')}>
          Equipos
        </button>
      </div>

      <div className="panel">
        {tab === 'services' ? (
          services.loading ? (
            <div style={{ padding: 24 }}><Spinner /></div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Disciplina</th>
                  <th className="num">Horas</th>
                  <th className="num">Días</th>
                  <th className="num">Precio</th>
                  <th className="num">% Prof.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.data?.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.isClass && <span className="badge role">Curso</span>} {s.name}
                    </td>
                    <td>{s.discipline ?? '—'}</td>
                    <td className="num">{s.hours}</td>
                    <td className="num">{s.days}</td>
                    <td className="num">{formatCOP(s.price)}</td>
                    <td className="num">{(s.professorPct * 100).toFixed(1)}%</td>
                    <td>
                      <button className="btn ghost" onClick={() => setEditing(s)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : equipment.loading ? (
          <div style={{ padding: 24 }}><Spinner /></div>
        ) : equipment.data?.length ? (
          <table className="data">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Categoría</th>
                <th className="num">Cantidad</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {equipment.data.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td className="num">{e.count}</td>
                  <td className="num">{formatCOP(e.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Sin equipos.</Empty>
        )}
      </div>

      {editing && (
        <ServiceForm
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            services.reload()
          }}
        />
      )}
    </div>
  )
}

function ServiceForm({ item, onClose, onSaved }: { item: ServiceCatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<ServiceCatalogItem, 'id'>>(item ? { ...item } : EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<Omit<ServiceCatalogItem, 'id'>>) => setForm((f) => ({ ...f, ...p }))

  async function save() {
    setBusy(true)
    try {
      if (item) await api.catalog.updateService(item.id, form)
      else await api.catalog.createService(form)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={item ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Guardar'}</button>
        </>
      }
    >
      <Field label="Nombre del servicio">
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="row3">
        <Field label="Horas de referencia">
          <input type="number" step="0.5" value={form.hours} onChange={(e) => set({ hours: Number(e.target.value) })} />
        </Field>
        <Field label="Días (>0 = por día)">
          <input type="number" value={form.days} onChange={(e) => set({ days: Number(e.target.value) })} />
        </Field>
        <Field label="Precio (COP)">
          <input type="number" value={form.price} onChange={(e) => set({ price: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="row3">
        <Field label="% del profesor (0–1)">
          <input type="number" step="0.01" value={form.professorPct} onChange={(e) => set({ professorPct: Number(e.target.value) })} />
        </Field>
        <Field label="Disciplina">
          <input value={form.discipline ?? ''} onChange={(e) => set({ discipline: e.target.value || null })} />
        </Field>
        <Field label="¿Es curso?">
          <select value={form.isClass ? '1' : '0'} onChange={(e) => set({ isClass: e.target.value === '1' })}>
            <option value="0">No</option>
            <option value="1">Sí (nivel de curso)</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}
