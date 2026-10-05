import { useEffect, useMemo, useState } from 'react'
import { useMonthDetail } from '../hooks/useKharchaData'
import { CATEGORY_LABELS, formatDisplayDate, formatINR, monthLabelFromKey } from '../lib/format'

const TABS = [
  { id: 'spend', label: 'Spend' },
  { id: 'income', label: 'Income' },
  { id: 'credit', label: 'Card' },
]

/**
 * Full day-by-day breakdown for one month — Spend / Income / Card as separate tabs.
 */
export default function MonthDetail({ month, onClose }) {
  const { data, error, loading, refreshing, refetch } = useMonthDetail(month)
  const [tab, setTab] = useState('spend')

  useEffect(() => {
    setTab('spend')
  }, [month])

  const label = monthLabelFromKey(month)

  const spendDays = useMemo(
    () => (data?.days || []).filter((d) => d.spend > 0 || (d.categories || []).length > 0 || d.note),
    [data],
  )
  const incomeDays = useMemo(() => (data?.days || []).filter((d) => d.income > 0), [data])
  const creditDays = useMemo(() => (data?.days || []).filter((d) => d.credit > 0), [data])

  if (!month) return null

  return (
    <section className="panel month-detail fade-in" aria-live="polite">
      <div className="panel-head">
        <div className="month-detail-title">
          <button type="button" className="back-chip" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h2>{label}</h2>
        </div>
        <button
          type="button"
          className={`refresh-btn dark ${refreshing ? 'is-spinning' : ''}`}
          onClick={() => refetch()}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      {loading && !data ? (
        <div className="month-detail-loading">
          <span className="spinner spinner-ink" />
          Loading days…
        </div>
      ) : null}

      {error && !data ? (
        <div className="empty-state error">
          <p className="error-text">{error}</p>
          <button type="button" className="btn ghost" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="month-tabs" role="tablist" aria-label="Month sections">
            {TABS.map((t) => {
              const value =
                t.id === 'spend'
                  ? data.totals.spend
                  : t.id === 'income'
                    ? data.totals.income
                    : data.totals.credit
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'month-tab on' : 'month-tab'}
                  onClick={() => setTab(t.id)}
                >
                  <span className="kpi-label">{t.label}</span>
                  <strong className={t.id === 'income' ? 'pos' : t.id === 'credit' ? 'neg' : ''}>
                    {t.id === 'income' ? '+' : t.id === 'credit' ? '−' : ''}
                    {formatINR(value)}
                  </strong>
                </button>
              )
            })}
          </div>

          <div key={tab} className="month-tab-panel" role="tabpanel">
            {tab === 'spend' ? (
              <>
                {(data.categories || []).length > 0 ? (
                  <div className="month-cats" aria-label="Category totals">
                    {(data.categories || []).slice(0, 8).map((c) => (
                      <span key={c.name} className="cat-chip">
                        <b>{CATEGORY_LABELS[c.name] || c.name}</b>
                        {formatINR(c.value)}
                      </span>
                    ))}
                  </div>
                ) : null}

                {spendDays.length === 0 ? (
                  <p className="muted">No spend in this month.</p>
                ) : (
                  <ul className="day-list">
                    {spendDays.map((day, i) => (
                      <li key={day.date} className="day-card" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                        <div className="day-card-head">
                          <strong>{formatDisplayDate(day.date)}</strong>
                          {day.spend > 0 ? <span className="neg">−{formatINR(day.spend)}</span> : null}
                        </div>
                        {day.categories?.length > 0 ? (
                          <ul className="day-cats">
                            {day.categories.map((c) => (
                              <li key={c.name}>
                                <span>{CATEGORY_LABELS[c.name] || c.name}</span>
                                <span>{formatINR(c.value)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {day.note ? <p className="day-note">{day.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {tab === 'income' ? (
              incomeDays.length === 0 ? (
                <p className="muted">No income in this month.</p>
              ) : (
                <ul className="day-list">
                  {incomeDays.map((day, i) => (
                    <li key={day.date} className="day-card" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                      <div className="day-card-head">
                        <strong>{formatDisplayDate(day.date)}</strong>
                        <span className="pos">+{formatINR(day.income)}</span>
                      </div>
                      {day.incomeNote ? <p className="day-note">{day.incomeNote}</p> : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === 'credit' ? (
              creditDays.length === 0 ? (
                <p className="muted">No card spends in this month.</p>
              ) : (
                <ul className="day-list">
                  {creditDays.map((day, i) => (
                    <li key={day.date} className="day-card" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                      <div className="day-card-head">
                        <strong>{formatDisplayDate(day.date)}</strong>
                        <span className="neg">−{formatINR(day.credit)}</span>
                      </div>
                      {day.creditNote ? <p className="day-note">{day.creditNote}</p> : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>

          {data.demo ? <p className="muted tip center">Demo month — connect Apps Script for live days.</p> : null}
        </>
      ) : null}
    </section>
  )
}
