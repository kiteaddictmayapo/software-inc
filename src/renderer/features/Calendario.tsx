import React, { useMemo, useState } from 'react'
import { api, useAsync, formatCOP, minutesToHHMM, todayISO } from '../lib/api'
import { Spinner, Empty } from '../components/ui'
import type { Transaction } from '@shared/types/domain'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const esReservaWeb = (t: Transaction) => (t.comment ?? '').startsWith('Reserva de Google Forms')

/** Calendario mensual con todos los eventos de la academia:
 *  clases del Club (abiertas = agendadas/en curso, cerradas = dadas) y
 *  reservas de Google Forms convertidas (llevan su badge). */
export function Calendario() {
  const hoy = todayISO()
  const [year, setYear] = useState(Number(hoy.slice(0, 4)))
  const [month, setMonth] = useState(Number(hoy.slice(5, 7)) - 1) // 0-11
  const [selected, setSelected] = useState<string>(hoy)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const from = iso(year, month, 1)
  const to = iso(year, month, daysInMonth)

  const txs = useAsync(() => api.transactions.list({ from, to, limit: 1000 }), [from, to])
  const persons = useAsync(() => api.persons.list({ limit: 2000 }), [])
  const services = useAsync(() => api.catalog.listServices(), [])

  const nameOf = (id: number | null) => persons.data?.find((p) => p.id === id)?.fullName ?? '—'
  const nickOf = (id: number | null) => {
    const p = persons.data?.find((x) => x.id === id)
    return p ? p.nickname || p.fullName : null
  }
  const svcOf = (t: Transaction) =>
    services.data?.find((s) => s.id === (t.resolvedServiceId ?? t.serviceId))?.name ?? (t.isClass ? 'Clase de curso' : t.serviceRaw ?? 'Servicio')

  /** Eventos por día (ordenados por hora). */
  const byDay = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of txs.data ?? []) {
      if (!m.has(t.txDate)) m.set(t.txDate, [])
      m.get(t.txDate)!.push(t)
    }
    for (const list of m.values()) list.sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0))
    return m
  }, [txs.data])

  function move(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
    setSelected(iso(y, m, 1))
  }
  function irHoy() {
    setYear(Number(hoy.slice(0, 4)))
    setMonth(Number(hoy.slice(5, 7)) - 1)
    setSelected(hoy)
  }

  // Rejilla: lunes = primera columna. getDay(): 0=Dom..6=Sáb -> desplazamiento L=0..D=6
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const dayEvents = byDay.get(selected) ?? []
  const busy = txs.loading || persons.loading

  return (
    <div>
      <div className="header">
        <h1>Calendario</h1>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn sm" onClick={() => move(-1)}>‹</button>
          <strong style={{ minWidth: 130, textAlign: 'center' }}>{MESES[month]} {year}</strong>
          <button className="btn sm" onClick={() => move(1)}>›</button>
          <button className="btn sm" onClick={irHoy}>Hoy</button>
        </div>
      </div>
      <p className="muted" style={{ margin: '-6px 0 14px' }}>
        Todos los eventos de la academia: clases del Club y reservas web convertidas.
        <span className="badge open" style={{ marginLeft: 8 }}>agendada / en curso</span>
      </p>

      {busy ? (
        <div className="panel"><div style={{ padding: 24 }}><Spinner /></div></div>
      ) : (
        <>
          <div className="panel">
            <div className="cal-grid cal-head">
              {DIAS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            </div>
            <div className="cal-grid">
              {cells.map((d, i) => {
                if (d == null) return <div key={i} className="cal-day empty" />
                const dISO = iso(year, month, d)
                const evs = byDay.get(dISO) ?? []
                const isToday = dISO === hoy
                const isSel = dISO === selected
                return (
                  <div
                    key={i}
                    className={'cal-day clickable' + (isToday ? ' today' : '') + (isSel ? ' selected' : '')}
                    onClick={() => setSelected(dISO)}
                  >
                    <div className="cal-num">{d}</div>
                    <div className="cal-chips">
                      {evs.slice(0, 3).map((t) => (
                        <div key={t.id} className={'cal-chip' + (t.isOpen ? ' open' : '')} title={`${svcOf(t)} — ${nameOf(t.clientId)}`}>
                          {t.startMin != null ? minutesToHHMM(t.startMin) + ' ' : ''}{nameOf(t.clientId).split(' ')[0]}
                        </div>
                      ))}
                      {evs.length > 3 && <div className="cal-more">+{evs.length - 3} más</div>}
                      {/* En móvil los chips se ocultan: puntos + contador */}
                      {evs.length > 0 && (
                        <div className="cal-dots">
                          {evs.slice(0, 4).map((t) => <span key={t.id} className={'dot' + (t.isOpen ? ' open' : '')} />)}
                          {evs.length > 4 && <span className="cal-count">{evs.length}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel panel-p" style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 10px' }}>
              {new Date(selected + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
              {selected === hoy && <span className="badge role" style={{ marginLeft: 8 }}>HOY</span>}
            </h3>
            {!dayEvents.length ? (
              <Empty>Sin eventos este día.</Empty>
            ) : (
              <table className="data">
                <thead><tr><th>Horario</th><th>Cliente</th><th>Servicio</th><th>Profesor</th><th /></tr></thead>
                <tbody>
                  {dayEvents.map((t) => (
                    <tr key={t.id} className={t.isOpen ? 'row-open' : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {t.startMin != null ? minutesToHHMM(t.startMin) : '—'}
                        {t.endMin != null ? `–${minutesToHHMM(t.endMin)}` : ''}
                      </td>
                      <td>{nameOf(t.clientId)}</td>
                      <td>
                        {t.txType === 'loan' ? <span className="badge loan">Alquiler</span> : t.isClass ? <span className="badge class">Clase</span> : null}{' '}
                        {svcOf(t)}
                        {esReservaWeb(t) && <span className="badge open" style={{ marginLeft: 6 }}>Reserva Web</span>}
                      </td>
                      <td>{nickOf(t.professorId) ?? '—'}</td>
                      <td className="num">
                        {t.isOpen
                          ? <span className="badge open">{t.txDate === hoy ? 'EN CURSO' : 'Agendada'}</span>
                          : <strong>{formatCOP(t.priceEffective)}</strong>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
