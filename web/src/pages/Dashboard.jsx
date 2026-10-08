import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useHistoryBackClose } from '../hooks/useHistoryBackClose'
import { useSummary } from '../hooks/useKharchaData'
import { useAuth } from '../lib/auth'
import {
  allMonthKeys,
  CATEGORY_LABELS,
  ENTRY_TYPE_LABELS,
  formatINR,
  monthLabelFromKey,
} from '../lib/format'

const PIE_COLORS = ['#0f3d2e', '#1a5c45', '#2d7a5c', '#4a9a74', '#7bb892', '#a8d0b8', '#c4a574', '#b87a4a']
const MONTH_PICK_START = '2024-07'

/** Prefer click on touch / coarse pointers; hover on desktop. */
function useChartTrigger() {
  const [trigger, setTrigger] = useState('click')
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setTrigger(mq.matches ? 'hover' : 'click')
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return trigger
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading, refreshing, refetch } = useSummary()
  const [scope, setScope] = useState('mtd')
  const [monthIndex, setMonthIndex] = useState(null)
  const [catIndex, setCatIndex] = useState(null)
  const [detailMonth, setDetailMonth] = useState(null)
  const [pickMonth, setPickMonth] = useState('')
  const [noteQuery, setNoteQuery] = useState('')
  const trigger = useChartTrigger()
  const canHover = trigger === 'hover'
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
      (data?.byMonth || []).map((m) => ({
        ...m,
        label: monthLabelFromKey(m.month),
      })),
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

  const quickMonths = useMemo(() => {
    const keys = []
    const d = new Date()
    for (let i = 0; i < 4; i++) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
      keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
    }
    return keys
  }, [])

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

  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const defaultPick =
    pickMonth ||
    (monthPickOptions.find((m) => m.month === thisMonthKey) || monthPickOptions[0] || {})?.month ||
    ''

  const isEmpty =
    !(data.byMonth || []).some((m) => m.spend || m.income || m.credit) &&
    !(data.recent || []).length

  return (
    <div className="page fade-in">
      {isEmpty ? (
        <section className="welcome-banner">
          <p className="welcome-kicker">You’re in</p>
          <h2>Start with today’s spend</h2>
          <p>Your Google Sheet is ready. Log a few expenses — Home fills itself.</p>
          <div className="welcome-actions">
            <Link className="btn primary" to="/expense" replace>
              Add spend
            </Link>
            {user?.spreadsheetUrl ? (
              <a className="btn ghost" href={user.spreadsheetUrl} target="_blank" rel="noreferrer">
                Open sheet
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="quick-actions" aria-label="Shortcuts">
        <Link className="quick-card" to="/expense" replace>
          <span className="quick-ico" aria-hidden>
            −
          </span>
          <span className="quick-label">Add spend</span>
        </Link>
        <button type="button" className="quick-card" onClick={() => setDetailMonth(thisMonthKey)}>
          <span className="quick-ico" aria-hidden>
            ▦
          </span>
          <span className="quick-label">This month</span>
        </button>
        {user?.spreadsheetUrl ? (
          <a className="quick-card" href={user.spreadsheetUrl} target="_blank" rel="noreferrer">
            <span className="quick-ico" aria-hidden>
              ↗
            </span>
            <span className="quick-label">Open sheet</span>
          </a>
        ) : (
          <Link className="quick-card" to="/income" replace>
            <span className="quick-ico" aria-hidden>
              +
            </span>
            <span className="quick-label">Add income</span>
          </Link>
        )}
      </section>

      <section className="hero-block">
        <div className="hero-top">
          <p className="hero-kicker">This month</p>
          <button
            type="button"
            className={`refresh-btn ${refreshing ? 'is-spinning' : ''}`}
            onClick={() => refetch()}
            disabled={refreshing}
            aria-label="Refresh"
          >
            {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
        <p className="hero-amount">{formatINR(data.mtd.spend)}</p>
        <p className="hero-meta">
          spent · net <span>{formatINR(data.mtd.net)}</span>
        </p>
      </section>

      <section className="kpi-row">
        <div className="kpi">
          <span className="kpi-label">Income</span>
          <strong>{formatINR(data.mtd.income)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Card</span>
          <strong>{formatINR(data.mtd.credit)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Top</span>
          <strong className="kpi-ellipsis">
            {topSpend ? CATEGORY_LABELS[topSpend.name] || topSpend.name : '—'}
          </strong>
          {topSpend ? <span className="kpi-sub">{formatINR(topSpend.value)}</span> : null}
        </div>
      </section>

      <BudgetCard spent={data.mtd.spend} />

      <section className="panel">
        <div className="panel-head">
          <h2>Spend by month</h2>
          <span className="panel-hint">{canHover ? 'Hover a bar' : 'Tap a bar'}</span>
        </div>
        <div
          className="chart-wrap"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <BarChart
              data={chartMonths}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              style={{ outline: 'none' }}
              onMouseMove={
                canHover
                  ? (state) => {
                      if (state?.activeTooltipIndex == null) return
                      setMonthIndex(Number(state.activeTooltipIndex))
                    }
                  : undefined
              }
              onMouseLeave={canHover ? () => setMonthIndex(null) : undefined}
              onClick={
                canHover
                  ? undefined
                  : (state) => {
                      if (state?.activeTooltipIndex == null) {
                        setMonthIndex(null)
                        return
                      }
                      const idx = Number(state.activeTooltipIndex)
                      setMonthIndex((prev) => (prev === idx ? null : idx))
                    }
              }
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#6b7c74' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7c74' }}
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
                    key={i}
                    fill={monthIndex === i ? '#0f3d2e' : '#1a5c45'}
                    fillOpacity={monthIndex == null || monthIndex === i ? 1 : 0.35}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`chart-insight ${selectedMonth ? 'has-selection' : ''}`}>
          <p className="chart-insight-hint muted tip center">
            {canHover ? 'Hover a bar for spend / income / card' : 'Tap a bar for spend / income / card'}
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
                  className="btn ghost chart-open-month"
                  onClick={() => setDetailMonth(selectedMonth.month)}
                >
                  Open month view
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Month view</h2>
        </div>
        <p className="muted tip">Tap a month for day-by-day spend, income, and card — or add from there.</p>
        <div className="month-chip-row" role="list">
          {quickMonths.map((key) => {
            const opt = monthPickOptions.find((m) => m.month === key)
            const isThis = key === thisMonthKey
            return (
              <button
                key={key}
                type="button"
                role="listitem"
                className={`month-chip ${isThis ? 'is-current' : ''}`}
                onClick={() => {
                  setPickMonth(key)
                  setDetailMonth(key)
                }}
              >
                <span className="month-chip-label">{monthLabelFromKey(key)}</span>
                <span className="month-chip-val">
                  {opt?.spend != null ? formatINR(opt.spend) : isThis ? formatINR(data.mtd.spend) : '—'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="month-pick-row">
          <label className="sr-only" htmlFor="month-pick">
            More months
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
            className="btn primary"
            disabled={!defaultPick}
            onClick={() => setDetailMonth(defaultPick)}
          >
            Open
          </button>
        </div>
      </section>

      <section className="panel">
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
              <div
                className="chart-wrap pie"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
              >
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
              <p className="chart-insight-hint muted tip center">
                {canHover ? 'Hover a slice or tap a category' : 'Tap a slice or category for details'}
              </p>
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

      <section className="panel">
        <div className="panel-head">
          <h2>Recent</h2>
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
                placeholder="Search notes, type, date…"
                autoComplete="off"
              />
            </label>
            {filteredRecent.length === 0 ? (
              <p className="muted">No matches for “{noteQuery.trim()}”.</p>
            ) : (
              <ul className="recent-list">
                {filteredRecent.map((r, i) => (
                  <li key={`${r.type}-${r.date}-${i}`}>
                    <div>
                      <div className="recent-top">
                        <strong className="recent-type">{ENTRY_TYPE_LABELS[r.type] || r.type}</strong>
                        <span className="muted">{r.date}</span>
                      </div>
                      {r.note ? <p className="recent-note">{r.note}</p> : null}
                    </div>
                    <strong className={r.type === 'income' ? 'pos' : 'neg'}>
                      {r.type === 'income' ? '+' : '−'}
                      {formatINR(r.total)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {data.demo && <p className="muted center tip">Demo numbers — connect Apps Script for live data.</p>}
    </div>
  )
}
