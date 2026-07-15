import React, { useState } from 'react'
import { api, useAsync } from '../lib/api'
import { Field, Spinner } from '../components/ui'

export function Ajustes() {
  return (
    <div>
      <div className="header"><h1>Ajustes</h1></div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <CompanyPanel />
        <SmtpPanel />
        <PinPanel />
        <BackupPanel />
      </div>
    </div>
  )
}

function CompanyPanel() {
  const { data } = useAsync(() => api.settings.getCompany(), [])
  const [form, setForm] = useState<any>(null)
  const [msg, setMsg] = useState('')
  React.useEffect(() => { if (data) setForm(data) }, [data])
  if (!form) return <div className="panel panel-p"><Spinner /></div>
  async function save() {
    await api.settings.setCompany(form)
    setMsg('Guardado.')
  }
  return (
    <div className="panel panel-p">
      <h3 style={{ marginTop: 0 }}>Empresa</h3>
      <Field label="Nombre"><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
      <Field label="NIT"><input value={form.companyNit} onChange={(e) => setForm({ ...form, companyNit: e.target.value })} /></Field>
      <Field label="Recargo tarjeta (0.05 = 5%)"><input type="number" step="0.01" value={form.cardSurchargePct} onChange={(e) => setForm({ ...form, cardSurchargePct: Number(e.target.value) })} /></Field>
      <button className="btn primary" onClick={save}>Guardar</button> <span className="ok">{msg}</span>
    </div>
  )
}

function SmtpPanel() {
  const { data } = useAsync(() => api.settings.getSmtp(), [])
  const [form, setForm] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  React.useEffect(() => { if (data) setForm(data) }, [data])
  if (!form) return <div className="panel panel-p"><Spinner /></div>
  async function save() {
    await api.settings.setSmtp({ ...form, password: password || undefined })
    setPassword('')
    setMsg('Guardado.')
  }
  async function test() {
    setBusy(true)
    setMsg('')
    try {
      const res = await api.settings.testSmtp()
      setMsg(res.ok ? 'Conexión SMTP correcta.' : 'Error: ' + res.error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel panel-p">
      <h3 style={{ marginTop: 0 }}>Correo (SMTP) para enviar facturas</h3>
      <div className="row2">
        <Field label="Servidor (host)"><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" /></Field>
        <Field label="Puerto"><input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} placeholder="587" /></Field>
      </div>
      <Field label="Usuario"><input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="tu-correo@gmail.com" /></Field>
      <Field label={`Contraseña (app password)${form.hasPassword ? ' — ya configurada' : ''}`}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={form.hasPassword ? '••••••••' : ''} />
      </Field>
      <Field label="Remitente (From)"><input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={save}>Guardar</button>
        <button className="btn" onClick={test} disabled={busy}>{busy ? <Spinner /> : 'Probar conexión'}</button>
      </div>
      <div style={{ marginTop: 8 }} className={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</div>
      <p className="muted" style={{ fontSize: 12 }}>Con Gmail usa una “contraseña de aplicación” (requiere verificación en 2 pasos). Puerto 587 (STARTTLS) o 465 (TLS).</p>
    </div>
  )
}

function PinPanel() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')
  async function change() {
    setMsg('')
    try {
      const res = await api.auth.change(cur, next)
      setMsg(res.ok ? 'PIN actualizado.' : 'PIN actual incorrecto.')
      if (res.ok) { setCur(''); setNext('') }
    } catch (e: any) {
      setMsg(e?.message ?? 'Error')
    }
  }
  return (
    <div className="panel panel-p">
      <h3 style={{ marginTop: 0 }}>Cambiar PIN</h3>
      <Field label="PIN actual"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="PIN nuevo"><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <button className="btn primary" onClick={change}>Cambiar</button> <span className="ok">{msg}</span>
    </div>
  )
}

function BackupPanel() {
  const { data, reload } = useAsync(() => api.backup.list(), [])
  const [msg, setMsg] = useState('')
  async function create() {
    const path = await api.backup.create()
    setMsg('Copia creada: ' + path)
    reload()
  }
  return (
    <div className="panel panel-p">
      <h3 style={{ marginTop: 0 }}>Respaldos y datos</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className="btn primary" onClick={create}>Crear copia ahora</button>
        <button className="btn" onClick={() => api.exports.openFolder()}>Abrir carpeta de exportaciones</button>
      </div>
      {msg && <div className="ok" style={{ fontSize: 12, marginBottom: 8 }}>{msg}</div>}
      <div className="muted" style={{ fontSize: 12 }}>Últimas copias:</div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
        {data?.slice(0, 5).map((b) => <li key={b.file}>{b.file} — {(b.size / 1024 / 1024).toFixed(1)} MB</li>)}
        {!data?.length && <li className="muted">Sin copias aún.</li>}
      </ul>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Recomendación: copia la carpeta de respaldos a un USB o a OneDrive.</p>
    </div>
  )
}
