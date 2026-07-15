import React, { useState } from 'react'
import { api, useAsync, formatCOP, todayISO } from '../lib/api'
import { Modal, Field, Spinner, Empty } from '../components/ui'

export function Bar() {
  const [selling, setSelling] = useState(false)
  const products = useAsync(() => api.bar.listProducts(), [])
  const sales = useAsync(() => api.bar.listSales(), [])
  const clients = useAsync(() => api.persons.list({ limit: 2000 }), [])

  return (
    <div>
      <div className="header">
        <h1>Bar</h1>
        <button className="btn primary" onClick={() => setSelling(true)}>+ Registrar venta</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-p"><strong>Inventario</strong></div>
          {products.loading ? <div style={{ padding: 20 }}><Spinner /></div> : (
            <table className="data">
              <thead><tr><th>Producto</th><th className="num">Costo u.</th><th className="num">Venta u.</th><th className="num">Stock</th></tr></thead>
              <tbody>
                {products.data?.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="num">{formatCOP(p.unitCost)}</td>
                    <td className="num">{formatCOP(p.sellPrice)}</td>
                    <td className="num" style={{ color: (p.stock ?? 0) <= 0 ? 'var(--danger)' : undefined }}>{p.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-p"><strong>Ventas recientes</strong></div>
          {sales.loading ? <div style={{ padding: 20 }}><Spinner /></div> : !sales.data?.length ? <Empty>Sin ventas.</Empty> : (
            <table className="data">
              <thead><tr><th>Fecha</th><th>Producto</th><th className="num">Cant.</th><th className="num">Total</th></tr></thead>
              <tbody>
                {sales.data.map((s) => (
                  <tr key={s.id}>
                    <td>{s.saleDate}</td>
                    <td>{s.productRaw ?? '—'}</td>
                    <td className="num">{s.qty}</td>
                    <td className="num">{formatCOP(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selling && products.data && (
        <SaleForm
          products={products.data}
          clients={(clients.data ?? []).filter((c) => c.isClient || c.isProfessor)}
          onClose={() => setSelling(false)}
          onSaved={() => {
            setSelling(false)
            products.reload()
            sales.reload()
          }}
        />
      )}
    </div>
  )
}

function SaleForm({ products, clients, onClose, onSaved }: any) {
  const [form, setForm] = useState({ saleDate: todayISO(), productId: '', qty: 1, clientId: '', paidCash: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (p: any) => setForm((f) => ({ ...f, ...p }))

  async function save() {
    setErr(null)
    if (!form.productId) return setErr('Selecciona un producto.')
    setBusy(true)
    try {
      await api.bar.createSale({
        saleDate: form.saleDate,
        productId: Number(form.productId),
        qty: Number(form.qty),
        clientId: form.clientId ? Number(form.clientId) : null,
        paidCash: form.paidCash,
        alreadyPaid: form.paidCash
      })
      onSaved()
    } catch (e: any) {
      setErr(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Registrar venta de bar" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Registrar'}</button></>}>
      <div className="row2">
        <Field label="Fecha"><input type="date" value={form.saleDate} onChange={(e) => set({ saleDate: e.target.value })} /></Field>
        <Field label="Cantidad"><input type="number" min={1} value={form.qty} onChange={(e) => set({ qty: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Producto">
        <select value={form.productId} onChange={(e) => set({ productId: e.target.value })}>
          <option value="">—</option>
          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {formatCOP(p.sellPrice)} · stock {p.stock}</option>)}
        </select>
      </Field>
      <Field label="Cliente (opcional, para cargar a su cuenta)">
        <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
          <option value="">Venta directa (efectivo)</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
      </Field>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={form.paidCash} onChange={(e) => set({ paidCash: e.target.checked })} /> Pagado en efectivo</label>
      {err && <div className="err">{err}</div>}
    </Modal>
  )
}
