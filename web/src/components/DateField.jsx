import { useRef } from 'react'
import {
  clampISOToToday,
  formatDisplayDate,
  shiftISO,
  todayISO,
  yesterdayISO,
} from '../lib/format'

export default function DateField({ value, onChange, disabled }) {
  const inputRef = useRef(null)
  const today = todayISO()
  const isToday = value === today
  const isYesterday = value === yesterdayISO()

  function setDate(next) {
    onChange(clampISOToToday(next))
  }

  function openCalendar(e) {
    if (disabled) return
    e.preventDefault()
    const el = inputRef.current
    if (!el) return
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker()
        return
      }
    } catch {
      /* fall through */
    }
    el.focus()
    el.click()
  }

  const nextDate = shiftISO(value, 1)
  const nextDisabled = disabled || nextDate > today

  return (
    <div className={`date-field ${disabled ? 'is-disabled' : ''}`}>
      <div className="date-field-top">
        <span className="field-label">Date</span>
        <div className="date-chips" role="group" aria-label="Quick dates">
          <button
            type="button"
            className={isToday ? 'date-chip on' : 'date-chip'}
            onClick={() => setDate(today)}
            disabled={disabled}
          >
            Today
          </button>
          <button
            type="button"
            className={isYesterday ? 'date-chip on' : 'date-chip'}
            onClick={() => setDate(yesterdayISO())}
            disabled={disabled}
          >
            Yesterday
          </button>
        </div>
      </div>

      <div className="date-picker-row">
        <button
          type="button"
          className="date-step"
          aria-label="Previous day"
          disabled={disabled}
          onClick={() => setDate(shiftISO(value, -1))}
        >
          ‹
        </button>

        <button
          type="button"
          className="date-picker"
          disabled={disabled}
          onClick={openCalendar}
          aria-label={`Choose date, currently ${formatDisplayDate(value)}`}
        >
          <span className="date-display">{formatDisplayDate(value)}</span>
          <input
            ref={inputRef}
            type="date"
            value={value}
            max={today}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <span className="date-cal" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className="date-step"
          aria-label="Next day"
          disabled={nextDisabled}
          onClick={() => setDate(nextDate)}
        >
          ›
        </button>
      </div>
    </div>
  )
}
