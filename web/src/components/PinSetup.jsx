import { useEffect, useRef, useState } from 'react'
import { setPin as apiSetPin } from '../lib/api'
import { markUnlocked, skipPinSetup } from '../lib/pinLock'
import KharchaLogo from './KharchaLogo'

const PIN_LEN = 6

/** First-time / optional PIN setup — Set or Skip. */
export default function PinSetup({ userId, onDone }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState('enter') // enter | confirm
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  function onChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, PIN_LEN)
    if (error) setError('')
    if (step === 'enter') {
      setPin(digits)
      if (digits.length === PIN_LEN) {
        window.setTimeout(() => setStep('confirm'), 0)
      }
    } else {
      setConfirm(digits)
      if (digits.length === PIN_LEN) {
        window.setTimeout(() => save(digits), 0)
      }
    }
  }

  async function save(confirmPin = confirm) {
    if (busy) return
    if (pin !== confirmPin) {
      setError('PINs don’t match — try again')
      setPin('')
      setConfirm('')
      setStep('enter')
      return
    }
    setBusy(true)
    try {
      await apiSetPin(pin)
      markUnlocked(userId)
      onDone({ hasPin: true })
    } catch (err) {
      setError(err.message || 'Could not save PIN')
      setPin('')
      setConfirm('')
      setStep('enter')
    } finally {
      setBusy(false)
    }
  }

  function onSkip() {
    skipPinSetup(userId)
    onDone({ hasPin: false, skipped: true })
  }

  function submit(e) {
    e.preventDefault()
    if (step === 'enter') {
      if (pin.length !== PIN_LEN) {
        setError('Enter 6 digits')
        return
      }
      setStep('confirm')
      return
    }
    if (confirm.length !== PIN_LEN) {
      setError('Confirm your PIN')
      return
    }
    save()
  }

  const value = step === 'enter' ? pin : confirm

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={submit} autoComplete="off">
        <KharchaLogo size={56} />
        <h1 className="lock-title">App PIN</h1>
        <p className="lock-sub">
          {step === 'enter'
            ? 'Optional 6-digit PIN to lock the app on this account. You can skip.'
            : 'Enter the same PIN again to confirm.'}
        </p>

        <label className="lock-label" htmlFor="expense-pin-setup">
          {step === 'enter' ? 'New PIN' : 'Confirm PIN'}
        </label>
        <input
          ref={inputRef}
          id="expense-pin-setup"
          className="lock-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          enterKeyHint="done"
          value={value}
          onChange={onChange}
          placeholder="••••••"
          maxLength={PIN_LEN}
          disabled={busy}
        />

        {error ? <p className="lock-error" role="alert">{error}</p> : <p className="lock-spacer" />}

        <button
          type="submit"
          className="btn primary lock-btn"
          disabled={busy || value.length !== PIN_LEN}
        >
          {busy ? 'Saving…' : step === 'enter' ? 'Continue' : 'Save PIN'}
        </button>

        {step === 'enter' ? (
          <button type="button" className="btn ghost lock-btn lock-skip" onClick={onSkip} disabled={busy}>
            Skip for now
          </button>
        ) : (
          <button
            type="button"
            className="btn ghost lock-btn lock-skip"
            onClick={() => {
              setConfirm('')
              setPin('')
              setStep('enter')
              setError('')
            }}
            disabled={busy}
          >
            Start over
          </button>
        )}
      </form>
    </div>
  )
}
