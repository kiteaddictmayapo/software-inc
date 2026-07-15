import React, { useEffect, useState } from 'react'
import { api, useAsync, formatCOP } from '../lib/api'
import { Avatar, Modal, Field, Spinner, Empty } from '../components/ui'
import type { Person, PersonInput } from '@shared/types/domain'

/** Convierte bytes a base64 por bloques (evita desbordar la pila con fotos grandes). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const EMPTY: PersonInput = {
  fullName: '',
  nickname: null,
  isClient: true,
  isProfessor: false,
  isSupplier: false,
  passport: null,
  email: null,
  country: null,
  birthDate: null,
  birthDateRaw: null,
  checkIn: null,
  checkOut: null,
  takingCourse: false,
  discountPct: 0,
  paid: 0,
  stillHere: true,
  comment: null,
  photoPath: null
}

export function Personas() {
  const [role, setRole] = useState<'client' | 'professor' | 'supplier'>('client')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const { data, loading, reload } = useAsync(() => api.persons.list({ role, search, limit: 500 }), [role, search])

  return (
    <div>
      <div className="header">
        <h1>Personas</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>
          + Nueva persona
        </button>
      </div>

      <div className="toolbar">
        <div className="btn-group" style={{ display: 'flex', gap: 6 }}>
          {(['client', 'professor', 'supplier'] as const).map((r) => (
            <button key={r} className={`btn ${role === r ? 'primary' : ''}`} onClick={() => setRole(r)}>
              {r === 'client' ? 'Clientes' : r === 'professor' ? 'Profesores' : 'Proveedores'}
            </button>
          ))}
        </div>
        <input className="grow" placeholder="Buscar por nombre, email o pasaporte…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="panel">
        {loading ? (
          <div style={{ padding: 24 }}>
            <Spinner />
          </div>
        ) : !data || data.length === 0 ? (
          <Empty>Sin resultados.</Empty>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 52 }} />
                <th>Nombre</th>
                <th>Roles</th>
                <th>País</th>
                <th>Email</th>
                <th className="num">Desc.</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <PersonRow key={p.id} person={p} onEdit={() => setEditing(p)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PersonForm
          person={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PersonRow({ person, onEdit }: { person: Person; onEdit: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null)
  useEffect(() => {
    if (person.photoThumbPath || person.photoPath) api.persons.photoDataUrl(person.id).then(setPhoto)
  }, [person.id, person.photoThumbPath])
  return (
    <tr>
      <td>
        <Avatar dataUrl={photo} name={person.fullName} />
      </td>
      <td>
        <strong>{person.fullName}</strong>
        {person.nickname && <div className="muted">{person.nickname}</div>}
      </td>
      <td>
        {person.isClient && <span className="badge role">Cliente</span>}
        {person.isProfessor && <span className="badge role">Profesor</span>}
        {person.isSupplier && <span className="badge role">Proveedor</span>}
      </td>
      <td>{person.country ?? '—'}</td>
      <td className="muted">{person.email ?? '—'}</td>
      <td className="num">{person.discountPct ? person.discountPct + '%' : '—'}</td>
      <td>{person.stillHere ? <span className="badge ok">Activo</span> : <span className="badge off">Inactivo</span>}</td>
      <td>
        <button className="btn ghost" onClick={onEdit}>
          Editar
        </button>
      </td>
    </tr>
  )
}

function PersonForm({ person, onClose, onSaved }: { person: Person | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PersonInput>(person ? { ...person } : EMPTY)
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (person && (person.photoThumbPath || person.photoPath)) api.persons.photoDataUrl(person.id).then(setPhoto)
  }, [person])

  const set = (patch: Partial<PersonInput>) => setForm((f) => ({ ...f, ...patch }))

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const b64 = bytesToBase64(new Uint8Array(buf))
    setPhoto('data:image/*;base64,' + b64)
    ;(form as any)._photoB64 = b64
    setForm((f) => ({ ...f }))
  }

  async function save() {
    setErr(null)
    if (!form.fullName.trim()) return setErr('El nombre es obligatorio.')
    setBusy(true)
    try {
      const payload: PersonInput = { ...form, email: form.email || null }
      const saved = person ? await api.persons.update(person.id, payload) : await api.persons.create(payload)
      const b64 = (form as any)._photoB64
      if (b64) await api.persons.setPhoto(saved.id, b64)
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={person ? 'Editar persona' : 'Nueva persona'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : 'Guardar'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <Avatar dataUrl={photo} name={form.fullName || '?'} size="lg" />
          <label className="btn" style={{ marginTop: 10, display: 'inline-block' }}>
            Foto…
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoFile} />
          </label>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Nombre completo">
            <input value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
          </Field>
          <div className="row2">
            <Field label="Apodo (profesores)">
              <input value={form.nickname ?? ''} onChange={(e) => set({ nickname: e.target.value || null })} />
            </Field>
            <Field label="Pasaporte / documento">
              <input value={form.passport ?? ''} onChange={(e) => set({ passport: e.target.value || null })} />
            </Field>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={form.isClient} onChange={(e) => set({ isClient: e.target.checked })} /> Cliente</label>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={form.isProfessor} onChange={(e) => set({ isProfessor: e.target.checked })} /> Profesor</label>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={form.isSupplier} onChange={(e) => set({ isSupplier: e.target.checked })} /> Proveedor</label>
      </div>

      <div className="row2" style={{ marginTop: 12 }}>
        <Field label="Email">
          <input type="email" value={form.email ?? ''} onChange={(e) => set({ email: e.target.value || null })} />
        </Field>
        <Field label="País">
          <input value={form.country ?? ''} onChange={(e) => set({ country: e.target.value || null })} />
        </Field>
      </div>
      <div className="row3">
        <Field label="Fecha de nacimiento">
          <input type="date" value={form.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value || null })} />
        </Field>
        <Field label="Check-in">
          <input type="date" value={form.checkIn ?? ''} onChange={(e) => set({ checkIn: e.target.value || null })} />
        </Field>
        <Field label="Check-out">
          <input type="date" value={form.checkOut ?? ''} onChange={(e) => set({ checkOut: e.target.value || null })} />
        </Field>
      </div>
      <div className="row3">
        <Field label="Descuento (%)">
          <input type="number" min={0} max={100} value={form.discountPct ?? 0} onChange={(e) => set({ discountPct: Number(e.target.value) })} />
        </Field>
        <Field label="Ya pagado (COP)">
          <input type="number" value={form.paid ?? 0} onChange={(e) => set({ paid: Number(e.target.value) })} />
        </Field>
        <Field label="Estado">
          <select value={form.stillHere ? '1' : '0'} onChange={(e) => set({ stillHere: e.target.value === '1' })}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </Field>
      </div>
      <Field label="Comentario">
        <textarea rows={2} value={form.comment ?? ''} onChange={(e) => set({ comment: e.target.value || null })} />
      </Field>
      {form.birthDateRaw && !form.birthDate && (
        <div className="err">Fecha de nacimiento original sin interpretar: “{form.birthDateRaw}”. Corrígela arriba.</div>
      )}
      {err && <div className="err">{err}</div>}
    </Modal>
  )
}
