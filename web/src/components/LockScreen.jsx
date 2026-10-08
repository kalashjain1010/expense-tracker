import { useEffect, useRef, useState } from 'react'
import { verifyPin } from '../lib/api'
import { markUnlocked } from '../lib/pinLock'
import KharchaLogo from './KharchaLogo'

const PIN_LEN = 6

export default function LockScreen({ userId, onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function attempt(nextPin) {
    const value = String(nextPin ?? '').trim()
    if (value.length !== PIN_LEN || busy) return

    setBusy(true)
    try {
      await verifyPin(value)
      markUnlocked(userId)
      setError('')
      onUnlock()
    } catch (err) {
      setShake(true)
      setError(err.message || 'Wrong PIN')
      setPin('')
      window.setTimeout(() => setShake(false), 420)
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  function submit(e) {
    e?.preventDefault()
    if (!pin.trim()) {
      setError('Enter your PIN')
      return
    }
    attempt(pin)
  }

  function onChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, PIN_LEN)
    setPin(digits)
    if (error) setError('')
    if (digits.length === PIN_LEN) {
      window.setTimeout(() => attempt(digits), 0)
    }
  }

  return (
    <div className="lock-screen">
      <form
        className={`lock-card ${shake ? 'is-shake' : ''}`}
        onSubmit={submit}
        autoComplete="off"
      >
        <KharchaLogo size={56} />
        <h1 className="lock-title">Expense Tracker</h1>
        <p className="lock-sub">Enter your 6-digit PIN to open</p>

        <label className="lock-label" htmlFor="expense-pin">
          PIN
        </label>
        <input
          ref={inputRef}
          id="expense-pin"
          className="lock-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          enterKeyHint="done"
          value={pin}
          onChange={onChange}
          placeholder="••••••"
          maxLength={PIN_LEN}
          disabled={busy}
        />

        {error ? <p className="lock-error" role="alert">{error}</p> : <p className="lock-spacer" />}

        <button type="submit" className="btn primary lock-btn" disabled={busy || pin.length !== PIN_LEN}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
