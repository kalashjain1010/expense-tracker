import { createPortal } from 'react-dom'

export default function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function StatusBanner({ status }) {
  if (!status) return null
  return (
    <div className={`status-banner ${status.type}`} role="status">
      {status.message}
    </div>
  )
}

/** Full-screen save state — portaled so page opacity/filters don’t muddy the UI */
export function SavingOverlay({ show, label = 'Saving to sheet…' }) {
  if (!show || typeof document === 'undefined') return null
  return createPortal(
    <div className="saving-overlay" role="alertdialog" aria-busy="true" aria-live="assertive">
      <div className="saving-card">
        <span className="spinner spinner-lg" />
        <p className="saving-title">{label}</p>
        <p className="saving-sub">Hang tight — sheet write in progress</p>
      </div>
    </div>,
    document.body,
  )
}
