import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import BudgetCard from '../components/BudgetCard'
import MonthDetail from '../components/MonthDetail'
import { DashboardSkeleton } from '../components/Skeleton'
import {
  EntryTypeIcon,
  IconCard,
  IconChevron,
  IconIncome,
  IconPlus,
  IconSheet,
  IconSpend,
} from '../components/TypeIcons'
import { useHistoryBackClose } from '../hooks/useHistoryBackClose'
import { useSummary } from '../hooks/useKharchaData'
import {
  allMonthKeys,
  CATEGORY_LABELS,
  ENTRY_TYPE_LABELS,
  formatINR,
  monthLabelFromKey,
} from '../lib/format'
import {
  currentMonthKey,
  daysElapsedInMonth,
  daysInMonth,
  formatLongDate,
  greetingForNow,
  prevMonthKey,
  spendPaceInsight,
} from '../lib/insights'

const RECENT_PATH = {
  expense: '/expense',
  income: '/income',
  credit: '/credit',
}

const PIE_COLORS = ['#0f3d2e', '#1a5c45', '#2d7a5c', '#4a9a74', '#7bb892', '#a8d0b8', '#c4a574', '#b87a4a']
const MONTH_PICK_START = '2024-07'
export default function Dashboard() {
  const { user } = useAuth()
  const sheetUrl = user?.spreadsheetUrl || ''
  const { data, error, loading, refreshing, refetch } = useSummary()
  const [scope, setScope] = useState('mtd')
  const [monthIndex, setMonthIndex] = useState(null)
  const [catIndex, setCatIndex] = useState(null)
  const [detailMonth, setDetailMonth] = useState(null)
  const [pickMonth, setPickMonth] = useState('')
  const [noteQuery, setNoteQuery] = useState('')
  // Mobile-first: always tap/click bars (hover is awkward on phone)
  const closeDetail = useHistoryBackClose(Boolean(detailMonth), () => setDetailMonth(null))

  useEffect(() => {
    setCatIndex(null)
  }, [scope])

  const filteredRecent = useMemo(() => {
    const list = data?.recent || []
    const q = noteQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const note = String(r.note || '').toLowerCase()
      const type = String(ENTRY_TYPE_LABELS[r.type] || r.type || '').toLowerCase()
      const date = String(r.date || '')
      return note.includes(q) || type.includes(q) || date.includes(q)
    })
  }, [data, noteQuery])

  const chartMonths = useMemo(
    () =>
      (data?.byMonth || [])
        .map((m) => ({
          ...m,
          label: monthLabelFromKey(m.month),
        }))
        .slice(-4), // last 4 months — readable on mobile
    [data],
  )

  const monthPickOptions = useMemo(() => {
    const byKey = Object.fromEntries((data?.byMonth || []).map((m) => [m.month, m]))
    const earliest = (data?.byMonth || []).map((m) => m.month).sort()[0]
    const fromKey = earliest && earliest < MONTH_PICK_START ? earliest : MONTH_PICK_START
    return allMonthKeys(fromKey).map((key) => ({
      month: key,
      spend: byKey[key]?.spend ?? null,
      income: byKey[key]?.income ?? null,
      credit: byKey[key]?.credit ?? null,
    }))
  }, [data])

  if (loading && !data) return <DashboardSkeleton />

  if (error && !data) {
    return (
      <div className="page">
        <div className="empty-state error">
          <p className="error-text">{error}</p>
          <button type="button" className="btn ghost" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return <DashboardSkeleton />

  if (detailMonth) {
    return (
      <div className="page">
        <MonthDetail month={detailMonth} onClose={closeDetail} />
      </div>
    )
  }

  const cats = (scope === 'mtd' ? data.topCategoriesMtd : data.topCategoriesAll).slice(0, 6)
  const topSpend = cats[0]
  const selectedMonth = monthIndex != null ? chartMonths[monthIndex] : null
  const selectedCat = catIndex != null ? cats[catIndex] : null
  const catTotal = cats.reduce((s, c) => s + (c.value || 0), 0)

  const thisMonthKey = currentMonthKey()
  const lastKey = prevMonthKey(thisMonthKey)
  const lastSpend = (data.byMonth || []).find((m) => m.month === lastKey)?.spend || 0
  const pace = spendPaceInsight(data.mtd.spend, lastSpend)
  const elapsed = daysElapsedInMonth(thisMonthKey)
  const totalDays = daysInMonth(thisMonthKey)
  const monthProgress = Math.min(100, Math.round((elapsed / totalDays) * 100))
  const monthName = monthLabelFromKey(thisMonthKey)

  const defaultPick =
    pickMonth ||
    (monthPickOptions.find((m) => m.month === thisMonthKey) || monthPickOptions[0] || {})?.month ||
    ''

  return (
    <div className="page home-page fade-in">
      <section className="home-hero" aria-label="This month overview">
        <div className="home-hero-glow" aria-hidden />
        <div className="home-hero-top">
          <div>
            <p className="home-hero-date">{formatLongDate()}</p>
            <h1 className="home-hero-greet">{greetingForNow()}</h1>
          </div>
          <button
            type="button"
            className={`refresh-btn ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => refetch()}
            disabled={refreshing}
            aria-label="Refresh"
          >
            {refreshing ? '…' : '↻'}
          </button>
        </div>

        <Link to="/expense?view=month" className="home-hero-main is-link">
          <div className="home-hero-copy">
            <p className="home-hero-kicker">
              <IconSpend size={12} /> {monthName} spend
            </p>
            <p className="home-hero-amount">{formatINR(data.mtd.spend)}</p>
            <p className="home-hero-meta">
              Net{' '}
              <strong className={data.mtd.net < 0 ? 'is-neg' : ''}>{formatINR(data.mtd.net)}</strong>
              {topSpend ? ` · ${CATEGORY_LABELS[topSpend.name] || topSpend.name}` : ''}
              <span className="home-hero-tap">
                Month view <IconChevron size={12} />
              </span>
            </p>
          </div>

          <div
            className="home-ring"
            role="img"
            aria-label={`Day ${elapsed} of ${totalDays}, ${monthProgress}% through the month`}
          >
            <svg viewBox="0 0 80 80" width="72" height="72">
              <circle className="home-ring-track" cx="40" cy="40" r="32" />
              <circle
                className="home-ring-value"
                cx="40"
                cy="40"
                r="32"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - monthProgress / 100)}
              />
            </svg>
            <div className="home-ring-label">
              <strong>
                {elapsed}
                <span>/{totalDays}</span>
              </strong>
              <em>days</em>
            </div>
          </div>
        </Link>

        <div className="home-stat-strip" aria-label="Jump to month totals">
          <Link to="/income?view=month" className="home-stat">
            <span className="home-stat-ico" aria-hidden>
              <IconIncome size={14} />
            </span>
            <span className="home-stat-copy">
              <span>Income</span>
              <strong>{formatINR(data.mtd.income)}</strong>
            </span>
            <IconChevron size={12} />
          </Link>
          <Link to="/credit" className="home-stat">
            <span className="home-stat-ico" aria-hidden>
              <IconCard size={14} />
            </span>
            <span className="home-stat-copy">
              <span>
                {data.creditOutstanding != null || data.mtd?.creditOutstanding != null
                  ? 'Card due'
                  : 'Card'}
              </span>
              <strong>
                {formatINR(
                  data.creditOutstanding ?? data.mtd?.creditOutstanding ?? data.mtd.credit,
                )}
              </strong>
            </span>
            <IconChevron size={12} />
          </Link>
        </div>

        <div className="home-cta-row">
          <Link to="/expense" className="home-cta primary">
            <IconPlus size={14} />
            <span>Log spend</span>
          </Link>
          <Link to="/income" className="home-cta">
            <IconIncome size={14} />
            <span>Income</span>
          </Link>
          {sheetUrl ? (
            <a
              className="home-cta ghost"
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconSheet size={14} />
              <span>Sheet</span>
            </a>
          ) : null}
        </div>
      </section>

      {pace ? (
        <section className="noticed-card">
          <div className="noticed-eyebrow">Noticed</div>
          <p>
            At this pace {monthName} lands near <strong>{formatINR(pace.pace)}</strong>
            {pace.compareLabel ? ` — ${pace.compareLabel}` : '.'}
          </p>
        </section>
      ) : null}

      <BudgetCard spent={data.mtd.spend} />

      <section className="panel soft-panel panel-chart">
        <div className="panel-head">
          <h2>Money in & out</h2>
          <span className="panel-hint">Select a month</span>
        </div>
        <div className="chart-legend">
          <span>
            <i className="lg-spend" /> Spend
          </span>
          <span>
            <i className="lg-income" /> Income
          </span>
        </div>
        <div className="chart-wrap" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <BarChart
              data={chartMonths}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              style={{ outline: 'none' }}
              onClick={(state) => {
                if (state?.activeTooltipIndex == null) {
                  setMonthIndex(null)
                  return
                }
                const idx = Number(state.activeTooltipIndex)
                setMonthIndex((prev) => (prev === idx ? null : idx))
              }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                width={40}
                domain={[0, 'auto']}
              />
              <Bar
                dataKey="spend"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                isAnimationActive={monthIndex == null}
                animationDuration={700}
              >
                {chartMonths.map((_, i) => (
                  <Cell
                    key={`s-${i}`}
                    fill={monthIndex === i ? '#0f3d2e' : '#1a5c45'}
                    fillOpacity={monthIndex == null || monthIndex === i ? 1 : 0.32}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="income"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                isAnimationActive={monthIndex == null}
                animationDuration={700}
              >
                {chartMonths.map((_, i) => (
                  <Cell
                    key={`i-${i}`}
                    fill={monthIndex === i ? '#7bb892' : '#a8d0b8'}
                    fillOpacity={monthIndex == null || monthIndex === i ? 1 : 0.32}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`chart-insight ${selectedMonth ? 'has-selection' : ''}`}>
          <p className="chart-insight-hint muted tip center">
            Select a bar for spend · income · card
          </p>
          <div className="chart-detail" aria-hidden={!selectedMonth}>
            {selectedMonth ? (
              <>
                <strong>{selectedMonth.label}</strong>
                <div className="chart-detail-grid">
                  <span>
                    Spend <b>{formatINR(selectedMonth.spend)}</b>
                  </span>
                  <span>
                    Income <b>{formatINR(selectedMonth.income)}</b>
                  </span>
                  <span>
                    Card <b>{formatINR(selectedMonth.credit)}</b>
                  </span>
                </div>
                <button
                  type="button"
                  className="text-btn chart-open-month"
                  onClick={() => setDetailMonth(selectedMonth.month)}
                >
                  Open {selectedMonth.label} days →
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel soft-panel panel-cats">
        <div className="panel-head">
          <h2>Where it goes</h2>
          <div className="segmented">
            <button type="button" className={scope === 'mtd' ? 'on' : ''} onClick={() => setScope('mtd')}>
              Month
            </button>
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
              All
            </button>
          </div>
        </div>
        {cats.length === 0 ? (
          <p className="muted">No category spend yet.</p>
        ) : (
          <>
            <div className="split-chart">
              <div className="chart-wrap pie" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart style={{ outline: 'none' }}>
                    <Pie
                      data={cats}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      strokeWidth={0}
                      isAnimationActive
                      animationDuration={650}
                      onClick={(_, index) => {
                        setCatIndex((prev) => (prev === index ? null : index))
                      }}
                    >
                      {cats.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          fillOpacity={catIndex == null || catIndex === i ? 1 : 0.35}
                          stroke={catIndex === i ? '#0f3d2e' : 'transparent'}
                          strokeWidth={catIndex === i ? 2 : 0}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="cat-list">
                {cats.map((c, i) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      className={catIndex === i ? 'cat-row on' : 'cat-row'}
                      onClick={() => setCatIndex((prev) => (prev === i ? null : i))}
                    >
                      <span className="dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="cat-name">{CATEGORY_LABELS[c.name] || c.name}</span>
                      <span className="cat-val">{formatINR(c.value)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`chart-insight chart-insight-cat ${selectedCat ? 'has-selection' : ''}`}>
              <p className="chart-insight-hint muted tip center">Select a category</p>
              <div className="chart-detail" aria-hidden={!selectedCat}>
                {selectedCat ? (
                  <>
                    <strong>{CATEGORY_LABELS[selectedCat.name] || selectedCat.name}</strong>
                    <div className="chart-detail-grid">
                      <span>
                        Amount <b>{formatINR(selectedCat.value)}</b>
                      </span>
                      <span>
                        Share{' '}
                        <b>{catTotal ? `${Math.round((selectedCat.value / catTotal) * 100)}%` : '—'}</b>
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="panel soft-panel panel-month-pick">
        <div className="panel-head">
          <h2>Open a month</h2>
        </div>
        <p className="muted tip">Day-by-day spend, income, and card.</p>
        <div className="month-pick-row">
          <label className="sr-only" htmlFor="month-pick">
            Month
          </label>
          <select
            id="month-pick"
            className="month-select"
            value={defaultPick}
            onChange={(e) => setPickMonth(e.target.value)}
          >
            {monthPickOptions.map((m) => (
              <option key={m.month} value={m.month}>
                {monthLabelFromKey(m.month)}
                {m.spend != null ? ` · ${formatINR(m.spend)}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn primary btn-compact"
            disabled={!defaultPick}
            onClick={() => setDetailMonth(defaultPick)}
          >
            View days
          </button>
        </div>
      </section>

      <section className="panel soft-panel panel-latest">
        <div className="panel-head">
          <h2>Latest</h2>
          <Link to="/expense?view=month" className="text-btn">
            See spend →
          </Link>
        </div>
        {(data.recent || []).length === 0 ? (
          <p className="muted">No recent entries yet.</p>
        ) : (
          <>
            <label className="search-field">
              <span className="sr-only">Search notes</span>
              <input
                type="search"
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="Search a note, type, date…"
                autoComplete="off"
              />
            </label>
            {filteredRecent.length === 0 ? (
              <p className="muted">No matches for “{noteQuery.trim()}”.</p>
            ) : (
              <ul className="activity-list">
                {filteredRecent.map((r, i) => {
                  const base = RECENT_PATH[r.type] || '/expense'
                  return (
                    <li key={`${r.type}-${r.date}-${i}`} style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                      <Link to={`${base}?date=${r.date}`} className="activity-row">
                        <span className={`activity-icon ${r.type}`} aria-hidden>
                          <EntryTypeIcon type={r.type} size={16} />
                        </span>
                        <span className="activity-main">
                          <strong>{ENTRY_TYPE_LABELS[r.type] || r.type}</strong>
                          <span className="activity-meta">
                            {r.date}
                            {r.note ? ` · ${r.note}` : ''}
                          </span>
                        </span>
                        <strong
                          className={`activity-amt ${
                            r.type === 'income' ? 'pos' : r.type === 'credit' ? 'credit' : 'neg'
                          }`}
                        >
                          {`${r.type === 'income' ? '+' : '−'}${formatINR(r.total)}`}
                        </strong>
                        <span className="activity-chev" aria-hidden>
                          <IconChevron size={13} />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {data.demo && <p className="muted center tip">Demo numbers — sign in with Google for your live sheet.</p>}
    </div>
  )
}
