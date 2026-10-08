import { useEffect, useState } from 'react'
import { formatINR } from '../lib/format'
import { getMonthBudget, setMonthBudget } from '../lib/prefs'

/** Soft monthly spend goal stored on-device (not in the sheet). */
export default function BudgetCard({ spent = 0 }) {
  const [budget, setBudget] = useState(() => getMonthBudget())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => (budget ? String(budget) : ''))

  useEffect(() => {
    if (!editing) setDraft(budget ? String(budget) : '')
  }, [budget, editing])

  const hasBudget = budget > 0
  const pct = hasBudget ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const over = hasBudget && spent > budget
  const left = hasBudget ? budget - spent : 0

  function save() {
    const next = setMonthBudget(draft)
    setBudget(next)
    setEditing(false)
  }

  return (
    <section className="panel budget-panel">
      <div className="panel-head">
        <h2>Month budget</h2>
        <button
          type="button"
          className="text-btn"
          onClick={() => (editing ? save() : setEditing(true))}
        >
          {editing ? 'Save' : hasBudget ? 'Edit' : 'Set'}
        </button>
      </div>

      {editing ? (
        <div className="budget-edit">
          <label className="field-label" htmlFor="month-budget">
            Soft spend limit (₹)
          </label>
          <input
            id="month-budget"
            type="number"
            inputMode="numeric"
            min="0"
            step="500"
            placeholder="e.g. 40000"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
          />
          <p className="muted tip">Stays on this phone only — not written to the sheet.</p>
        </div>
      ) : !hasBudget ? (
        <p className="muted">Set a soft limit to see how this month is tracking.</p>
      ) : (
        <>
          <div className="budget-stats">
            <div>
              <span className="kpi-label">Spent</span>
              <strong className={over ? 'neg' : ''}>{formatINR(spent)}</strong>
            </div>
            <div>
              <span className="kpi-label">Limit</span>
              <strong>{formatINR(budget)}</strong>
            </div>
            <div>
              <span className="kpi-label">{over ? 'Over' : 'Left'}</span>
              <strong className={over ? 'neg' : 'pos'}>
                {formatINR(Math.abs(left))}
              </strong>
            </div>
          </div>
          <div
            className={`budget-bar ${over ? 'is-over' : ''}`}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="muted tip center">{over ? `${pct}% of budget · over limit` : `${pct}% of budget`}</p>
        </>
      )}
    </section>
  )
}
