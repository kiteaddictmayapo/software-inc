import React, { useEffect, useState } from 'react'

/**
 * Viento en vivo en la escuela (Mayapo, La Guajira):
 *  - Franja con los datos actuales del punto exacto (Open-Meteo, gratuita y sin clave).
 *  - Mapa animado de Windy con la escuela marcada.
 * Requiere internet; funciona igual en escritorio, web y demo (es solo renderer).
 */

// Pin real de "Kite Addict Colombia – Kitesurf School Mayapo" en Google Maps
const LAT = 11.6773
const LON = -72.7709

const WINDY_EMBED =
  'https://embed.windy.com/embed2.html' +
  `?lat=${LAT}&lon=${LON}&detailLat=${LAT}&detailLon=${LON}` +
  '&zoom=11&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true' +
  '&calendar=now&type=map&location=coordinates&metricWind=kt&metricTemp=%C2%B0C'

const WINDY_SITE = `https://www.windy.com/${LAT}/${LON}?${LAT},${LON},11`

const OPEN_METEO =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${LAT}&longitude=${LON}` +
  '&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
  '&wind_speed_unit=kn&timezone=America%2FBogota'

/** Grados → rosa de los vientos de 16 puntos (dirección DESDE donde sopla). */
function rosa(deg: number): string {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  return pts[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

interface Ahora {
  time: string
  speed: number
  gusts: number
  direction: number
}

export function Viento() {
  const [ahora, setAhora] = useState<Ahora | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function cargar() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(OPEN_METEO)
      if (!res.ok) throw new Error(String(res.status))
      const j = await res.json()
      setAhora({
        time: j.current.time,
        speed: j.current.wind_speed_10m,
        gusts: j.current.wind_gusts_10m,
        direction: j.current.wind_direction_10m
      })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    cargar()
  }, [])

  return (
    <div>
      <div className="header">
        <h1>Viento en la escuela</h1>
        <button className="btn" onClick={() => window.open(WINDY_SITE, '_blank')} title="Abre el pronóstico completo en el navegador">
          Abrir en Windy
        </button>
      </div>

      <div className="panel panel-p viento-now">
        {loading ? (
          <span className="muted">Cargando dato en vivo…</span>
        ) : error || !ahora ? (
          <span className="muted">
            No se pudo cargar el dato en vivo (¿sin internet?). El mapa de abajo se actualiza por su cuenta.{' '}
            <button className="btn sm" onClick={cargar}>Reintentar</button>
          </span>
        ) : (
          <>
            <div className="viento-stat">
              <div className="viento-num">{Math.round(ahora.speed)} <small>nudos</small></div>
              <div className="muted">Viento ahora</div>
            </div>
            <div className="viento-stat">
              <div className="viento-num">{Math.round(ahora.gusts)} <small>nudos</small></div>
              <div className="muted">Ráfagas</div>
            </div>
            <div className="viento-stat">
              <div className="viento-num">
                {/* La flecha apunta hacia DONDE va el viento (el dato es de dónde viene) */}
                <span className="viento-flecha" style={{ transform: `rotate(${ahora.direction + 180}deg)` }}>↑</span>{' '}
                {rosa(ahora.direction)} <small>{Math.round(ahora.direction)}°</small>
              </div>
              <div className="muted">Dirección (desde)</div>
            </div>
            <div className="viento-stat">
              <div className="muted" style={{ fontSize: 12 }}>
                Medido a las {ahora.time.slice(11, 16)} en el punto de la escuela
                <br />
                <button className="btn sm" style={{ marginTop: 4 }} onClick={cargar}>Actualizar</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="viento-mapa">
        <iframe src={WINDY_EMBED} title="Mapa de viento — Mayapo" />
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Mapa en vivo de Windy.com con la escuela marcada (Mayapo). Velocidades en nudos; el mapa necesita conexión a internet.
      </p>
    </div>
  )
}
