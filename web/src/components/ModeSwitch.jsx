/** Verdelo-style Log / This month switch for entry tabs. */
export default function ModeSwitch({ value, onChange, monthLabel = 'This month' }) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Page mode">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'log'}
        className={value === 'log' ? 'on' : ''}
        onClick={() => onChange('log')}
      >
        Log
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'month'}
        className={value === 'month' ? 'on' : ''}
        onClick={() => onChange('month')}
      >
        {monthLabel}
      </button>
    </div>
  )
}
