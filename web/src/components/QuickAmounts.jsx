const AMOUNTS = [50, 100, 200, 500, 1000]

/** Compact +₹ chips — taps add to the active category / field. */
export default function QuickAmounts({ onAdd, disabled, label = 'Quick add' }) {
  return (
    <div className="quick-amounts" role="group" aria-label={label}>
      <span className="quick-amounts-label">{label}</span>
      <div className="quick-amounts-row">
        {AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            className="quick-amt"
            disabled={disabled}
            onClick={() => onAdd(amt)}
          >
            +{amt}
          </button>
        ))}
      </div>
    </div>
  )
}
