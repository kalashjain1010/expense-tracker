import { useRef, useState } from 'react'
import { verifyPin } from '../lib/api'
import { focusPinInput, useAutoFocusPin } from '../hooks/useAutoFocusPin'
import { useIsMobile } from '../hooks/useIsMobile'
import { markUnlocked } from '../lib/pinLock'
import KharchaLogo from './KharchaLogo'

const PIN_LEN = 6
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function LockScreen({ userId, onUnlock }) {
  const isMobile = useIsMobile()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const pinRef = useRef('')
  const inputRef = useRef(null)

  useAutoFocusPin(inputRef, [isMobile], { delayMs: 80, enabled: !isMobile })

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
      pinRef.current = ''
      window.setTimeout(() => setShake(false), 420)
      if (!isMobile) focusPinInput(inputRef.current)
    } finally {
      setBusy(false)
    }
  }

  function setDigits(digits) {
    const next = String(digits).replace(/\D/g, '').slice(0, PIN_LEN)
    setPin(next)
    pinRef.current = next
    if (error) setError('')
    if (next.length === PIN_LEN) {
      window.setTimeout(() => attempt(next), 0)
    }
  }

  function onKey(key) {
    if (busy) return
    if (key === '⌫') {
      setDigits(pinRef.current.slice(0, -1))
      return
    }
    if (!key) return
    setDigits(pinRef.current + key)
  }

  return (
    <div
      className="lock-screen"
      onPointerDownCapture={() => {
        if (!isMobile) focusPinInput(inputRef.current)
      }}
    >
      <form
        className={`lock-card ${shake ? 'is-shake' : ''}`}
        onSubmit={(e) => {
          e.preventDefault()
          attempt(pin)
        }}
        autoComplete="off"
      >
        <KharchaLogo size={56} />
        <h1 className="lock-title">Expense Tracker</h1>
        <p className="lock-sub">Enter your 6-digit PIN</p>

        {isMobile ? (
          <>
            <div className="lock-dots" aria-label={`PIN ${pin.length} of ${PIN_LEN}`} role="status">
              {Array.from({ length: PIN_LEN }, (_, i) => (
                <span key={i} className={`lock-dot ${i < pin.length ? 'on' : ''}`} />
              ))}
            </div>
            {error ? <p className="lock-error" role="alert">{error}</p> : <p className="lock-spacer" />}
            <div className="lock-pad" role="group" aria-label="PIN keypad">
              {KEYS.map((key, i) =>
                key === '' ? (
                  <span key={`empty-${i}`} className="lock-pad-empty" />
                ) : (
                  <button
                    key={key === '⌫' ? 'back' : key}
                    type="button"
                    className={`lock-pad-key ${key === '⌫' ? 'is-back' : ''}`}
                    disabled={busy}
                    onClick={() => onKey(key)}
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          </>
        ) : (
          <>
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
              autoFocus
              value={pin}
              onChange={(e) => setDigits(e.target.value)}
              placeholder="••••••"
              maxLength={PIN_LEN}
              disabled={busy}
            />
            {error ? <p className="lock-error" role="alert">{error}</p> : <p className="lock-spacer" />}
            <button
              type="submit"
              className="btn primary lock-btn"
              disabled={busy || pin.length !== PIN_LEN}
            >
              Unlock
            </button>
          </>
        )}
      </form>
    </div>
  )
}
