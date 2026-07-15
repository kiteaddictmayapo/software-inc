import React from 'react'

export function Spinner() {
  return <span className="spinner" />
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal>
        <div className="modal-h">
          <span>{title}</span>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Avatar({ dataUrl, name, size }: { dataUrl?: string | null; name: string; size?: 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  if (dataUrl) return <img className={`avatar ${size ?? ''}`} src={dataUrl} alt={name} />
  return <span className={`avatar ${size ?? ''}`}>{initials || '?'}</span>
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}
