import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHistoryBackClose } from '../hooks/useHistoryBackClose'
import { useMonthDetail, useSummary } from '../hooks/useKharchaData'
import { EntryTypeIcon } from './TypeIcons'
import {
  CATEGORY_LABELS,
  ENTRY_TYPE_LABELS,
  formatDisplayDate,
  formatINR,
  monthLabelFromKey,
} from '../lib/format'
import {
  currentMonthKey,
  daysElapsedInMonth,
  daysInMonth,
  deltaPct,
  monthField,
  prevMonthKey,
  spendPaceInsight,
} from '../lib/insights'
import MonthDetail from './MonthDetail'

const KIND_META = {
  expense: {
    title: 'Spend this month',
    detailTab: 'spend',
    empty: 'No spend logged yet this month.',
    sign: '−',
    tone: 'neg',
    path: '/expense',
  },
  income: {
    title: 'Income this month',
    detailTab: 'income',
    empty: 'No income logged yet this month.',
    sign: '+',
    tone: 'pos',
    path: '/income',
  },
  credit: {
    title: 'Card this month',
    detailTab: 'credit',
    empty: 'No card spends yet this month.',
    sign: '−',
    tone: 'credit',
    path: '/credit',
  },
}

/**
 * Month pulse + day list for Spend / Income / Card tabs.
 * Uses summary for headline; loads month detail for the day feed.
 */
export default function TabMonthView({ kind = 'expense' }) {
  const meta = KIND_META[kind] || KIND_META.expense
  const thisKey = currentMonthKey()
  const [month, setMonth] = useState(thisKey)
  const [fullDetail, setFullDetail] = useState(false)
  const closeFull = useHistoryBackClose(fullDetail, () => setFullDetail(false))

  const { data: summary, loading: summaryLoading, error: summaryError, refetch } = useSummary()
  const { data: detail, loading: detailLoading, error: detailError, refreshing, refetch: refetchDetail } =
    useMonthDetail(month)

  const byMonth = useMemo(() => summary?.byMonth || [], [summary])
  const monthRow = byMonth.find((m) => m.month === month)
  const prevRow = byMonth.find((m) => m.month === prevMonthKey(month))
  const amount = monthField(monthRow, kind)
  const prevAmount = monthField(prevRow, kind)
  const delta = deltaPct(amount, prevAmount)
  const isCurrent = month === thisKey

  const monthOptions = useMemo(() => {
    const keys = new Set(byMonth.map((m) => m.month))
    keys.add(thisKey)
    return [...keys].sort().reverse().slice(0, 14)
  }, [byMonth, thisKey])

  const days = useMemo(() => {
    const list = detail?.days || []
    if (kind === 'expense') {
      return list.filter((d) => d.spend > 0 || (d.categories || []).length > 0 || d.note)
    }
    if (kind === 'income') return list.filter((d) => d.income > 0)
    return list.filter((d) => d.credit > 0)
  }, [detail, kind])

  const categories = useMemo(() => {
    if (kind !== 'expense') return []
    if (detail?.categories?.length) return detail.categories.slice(0, 5)
    if (isCurrent && summary?.topCategoriesMtd) return summary.topCategoriesMtd.slice(0, 5)
    return []
  }, [kind, detail, isCurrent, summary])

  const pace =
    kind === 'expense' && isCurrent
      ? spendPaceInsight(amount || summary?.mtd?.spend || 0, prevAmount)
      : null

  const elapsed = daysElapsedInMonth(month)
  const totalDays = daysInMonth(month)
  const progress = Math.min(100, Math.round((elapsed / totalDays) * 100))

  if (fullDetail) {
    return (
      <div className="page">
        <MonthDetail month={month} initialTab={meta.detailTab} onClose={closeFull} />
      </div>
    )
  }

  if (summaryLoading && !summary) {
    return (
      <div className="tab-month fade-in">
        <div className="pulse-card is-loading">
          <span className="spinner" />
          Loading month…
        </div>
      </div>
    )
  }

  if (summaryError && !summary) {
    return (
      <div className="tab-month">
        <div className="empty-state error">
          <p className="error-text">{summaryError}</p>
          <button type="button" className="btn ghost" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-month fade-in">
      <section className="pulse-card">
        <div className="pulse-top">
          <div>
            <p className="hero-kicker pulse-kicker">{monthLabelFromKey(month)}</p>
            <h2 className="pulse-title">{meta.title}</h2>
          </div>
          <button
            type="button"
            className={`refresh-btn dark ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => {
              refetch()
              refetchDetail()
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>

        <p className={`pulse-amount ${meta.tone}`}>
          {meta.sign}
          {formatINR(amount)}
        </p>

        <div className="pulse-meta-row">
          {prevAmount > 0 || amount > 0 ? (
            <span className={`pulse-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
              {delta === 0
                ? 'Same as last month'
                : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs last month`}
            </span>
          ) : (
            <span className="muted tip">First month with data</span>
          )}
          <span className="muted tip">
            Day {elapsed} / {totalDays}
          </span>
        </div>

        <div className="pulse-progress" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>

        {pace ? (
          <p className="pulse-insight">
            At this pace, month ends near <strong>{formatINR(pace.pace)}</strong>
            {pace.compareLabel ? ` — ${pace.compareLabel}` : '.'}
          </p>
        ) : null}

        <label className="month-chip-label" htmlFor={`tab-month-${kind}`}>
          Jump month
        </label>
        <div className="month-chip-scroll">
          {monthOptions.map((key) => (
            <button
              key={key}
              id={key === month ? `tab-month-${kind}` : undefined}
              type="button"
              className={key === month ? 'month-chip on' : 'month-chip'}
              onClick={() => setMonth(key)}
            >
              {monthLabelFromKey(key)}
            </button>
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="panel soft-panel">
          <div className="panel-head">
            <h2>Where it went</h2>
          </div>
          <ul className="pulse-cat-list">
            {categories.map((c, i) => {
              const max = categories[0]?.value || 1
              const pct = Math.max(6, Math.round((c.value / max) * 100))
              return (
                <li key={c.name}>
                  <div className="pulse-cat-row">
                    <span>{CATEGORY_LABELS[c.name] || c.name}</span>
                    <strong>{formatINR(c.value)}</strong>
                  </div>
                  <div className="pulse-cat-bar">
                    <span style={{ width: `${pct}%`, animationDelay: `${i * 0.05}s` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="panel soft-panel">
        <div className="panel-head">
          <h2>Days</h2>
          <button type="button" className="text-btn" onClick={() => setFullDetail(true)}>
            Full month →
          </button>
        </div>

        {detailLoading && !detail ? (
          <div className="month-detail-loading">
            <span className="spinner spinner-ink" />
            Loading days…
          </div>
        ) : null}

        {detailError && !detail ? (
          <div className="empty-state error">
            <p className="error-text">{detailError}</p>
            <button type="button" className="btn ghost" onClick={() => refetchDetail()}>
              Try again
            </button>
          </div>
        ) : null}

        {detail && days.length === 0 ? <p className="muted">{meta.empty}</p> : null}

        {days.length > 0 ? (
          <ul className="activity-list">
            {days.map((day, i) => {
              const value =
                kind === 'expense' ? day.spend : kind === 'income' ? day.income : day.credit
              const note =
                kind === 'expense' ? day.note : kind === 'income' ? day.incomeNote : day.creditNote
              const catBits =
                kind === 'expense' && day.categories?.length
                  ? day.categories
                      .slice(0, 2)
                      .map((c) => CATEGORY_LABELS[c.name] || c.name)
                      .join(' · ')
                  : ''
              return (
                <li key={day.date} style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
                  <Link to={`${meta.path}?date=${day.date}`} className="activity-row">
                    <span
                      className={`activity-icon ${kind === 'expense' ? 'expense' : kind}`}
                      aria-hidden
                    >
                      <EntryTypeIcon
                        type={kind === 'expense' ? 'expense' : kind === 'income' ? 'income' : 'credit'}
                        size={16}
                      />
                    </span>
                    <span className="activity-main">
                      <strong>{formatDisplayDate(day.date)}</strong>
                      <span className="activity-meta">
                        {ENTRY_TYPE_LABELS[kind === 'expense' ? 'expense' : kind === 'income' ? 'income' : 'credit']}
                        {catBits ? ` · ${catBits}` : ''}
                        {note ? ` · ${note}` : ''}
                      </span>
                    </span>
                    <strong className={`activity-amt ${meta.tone}`}>
                      {meta.sign}
                      {formatINR(value)}
                    </strong>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
