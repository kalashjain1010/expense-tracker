import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addExpense } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import ModeSwitch from '../components/ModeSwitch'
import MonthTotalChip from '../components/MonthTotalChip'
import QuickAmounts from '../components/QuickAmounts'
import TabMonthView from '../components/TabMonthView'
import { CategoryIcon } from '../components/TypeIcons'
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  clampISOToToday,
  formatINR,
  todayISO,
} from '../lib/format'
import {
  getPinnedCategories,
  getRecentNotes,
  orderedCategories,
  rememberNote,
  setLastUsedCategory,
  togglePinnedCategory,
} from '../lib/prefs'

const emptyCats = () => Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, '']))

function catsFromEntry(categories = {}) {
  const next = emptyCats()
  EXPENSE_CATEGORIES.forEach((c) => {
    const v = categories[c]
    next[c] = v === 0 || v === '' || v == null ? '' : String(v)
  })
  return next
}

function initialDateFromUrl(params) {
  const raw = params.get('date')
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayISO()
  return clampISOToToday(raw)
}

function primaryCategory(categories) {
  let best = ''
  let max = 0
  EXPENSE_CATEGORIES.forEach((c) => {
    const n = Number(categories[c]) || 0
    if (n > max) {
      max = n
      best = c
    }
  })
  return best
}

export default function ExpensePage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(() => (searchParams.get('view') === 'month' ? 'month' : 'log'))
  const [date, setDate] = useState(() => initialDateFromUrl(searchParams))
  const [categories, setCategories] = useState(emptyCats)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [catOrder, setCatOrder] = useState(() => orderedCategories())
  const [pins, setPins] = useState(() => getPinnedCategories())
  const [focusCat, setFocusCat] = useState(() => orderedCategories()[0] || EXPENSE_CATEGORIES[0])
  const [noteHints, setNoteHints] = useState(() => getRecentNotes())
  const { data: existing, loading, refreshing, error: loadError } = useEntry('expense', date)

  useEffect(() => {
    setDate(initialDateFromUrl(searchParams))
    if (searchParams.get('view') === 'month') setMode('month')
  }, [searchParams])

  const total = useMemo(
    () =>
      EXPENSE_CATEGORIES.reduce((sum, c) => {
        const n = Number(categories[c])
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [categories],
  )

  useEffect(() => {
    setCategories(emptyCats())
    setNote('')
    setStatus(null)
  }, [date])

  useEffect(() => {
    if (loading) return
    if (!existing) return
    if (existing.date && existing.date !== date) return
    if (existing.found) {
      setCategories(catsFromEntry(existing.categories))
      setNote(existing.note || '')
    } else {
      setCategories(emptyCats())
      setNote('')
    }
  }, [existing, date, loading])

  useEffect(() => {
    if (loadError) setStatus({ type: 'error', message: loadError })
  }, [loadError])

  function setCat(name, value) {
    setCategories((prev) => ({ ...prev, [name]: value }))
  }

  function addToFocused(amount) {
    const cur = Number(categories[focusCat]) || 0
    setCat(focusCat, String(cur + amount))
  }

  function onPin(category) {
    const next = togglePinnedCategory(category)
    setPins(next)
    setCatOrder(orderedCategories())
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (total <= 0) {
      setStatus({ type: 'error', message: 'Enter at least one category amount.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const data = await addExpense({ date, categories, note })
      setNoteHints(rememberNote(note))
      const used = primaryCategory(categories) || focusCat
      if (used) {
        setLastUsedCategory(used)
        setCatOrder(orderedCategories())
        setFocusCat(used)
      }
      if (data.queued) {
        setStatus({
          type: 'ok',
          message: `Saved offline · ${formatINR(data.total ?? total)} — syncs when you’re back online`,
        })
      } else {
        const verb = data.updated ? 'Updated' : 'Saved'
        setStatus({
          type: 'ok',
          message: data.demo ? `Demo · ${formatINR(total)}` : `${verb} · ${formatINR(data.total ?? total)}`,
        })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !loading)
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  return (
    <div className={`page entry-page entry-${mode} fade-in`}>
      <header className="page-head page-head-row">
        <div>
          <h1>{mode === 'month' ? 'Spend' : editing ? 'Edit spend' : 'Spend'}</h1>
          <p className="lede">
            {mode === 'month' ? 'This month’s categories & days' : 'Log a day · pin with ★'}
          </p>
        </div>
        <ModeSwitch value={mode} onChange={setMode} monthLabel="Month" />
      </header>

      {mode === 'month' ? <TabMonthView kind="expense" /> : null}

      {mode === 'log' ? (
      <>
      <MonthTotalChip kind="expense" />
      <form className="form form-compact" onSubmit={onSubmit}>
        <DateField value={date} onChange={setDate} disabled={busy} />
        <EntryModeBanner
          loading={loadingEntry || (refreshing && !matched)}
          existing={matched ? existing : null}
          label="spend"
        />

        <QuickAmounts
          disabled={busy}
          label={`Quick add → ${CATEGORY_LABELS[focusCat] || focusCat}`}
          onAdd={addToFocused}
        />

        <div className={`cat-grid ${loadingEntry ? 'is-dim' : ''}`}>
          {catOrder.map((c) => {
            const pinned = pins.includes(c)
            return (
              <div
                key={c}
                className={`cat-field ${pinned ? 'is-pinned' : ''} ${focusCat === c ? 'is-focused' : ''}`}
              >
                <div className="cat-field-top">
                  <span className="field-label">
                    <span className="cat-ico" aria-hidden>
                      <CategoryIcon name={c} size={13} />
                    </span>
                    {CATEGORY_LABELS[c] || c}
                  </span>
                  <button
                    type="button"
                    className={`pin-btn ${pinned ? 'on' : ''}`}
                    aria-label={pinned ? `Unpin ${CATEGORY_LABELS[c] || c}` : `Pin ${CATEGORY_LABELS[c] || c}`}
                    aria-pressed={pinned}
                    disabled={busy}
                    onClick={() => onPin(c)}
                  >
                    {pinned ? '★' : '☆'}
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="—"
                  value={categories[c]}
                  disabled={busy}
                  onFocus={() => setFocusCat(c)}
                  onChange={(e) => setCat(c, e.target.value)}
                />
              </div>
            )
          })}
        </div>

        <Field label="Note" hint="Optional">
          <textarea
            rows={2}
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Zomato – 250…"
          />
        </Field>

        {noteHints.length > 0 ? (
          <div className="note-hints" role="group" aria-label="Recent notes">
            {noteHints.slice(0, 5).map((hint) => (
              <button
                key={hint}
                type="button"
                className="note-hint"
                disabled={busy}
                onClick={() => setNote(hint)}
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null}

        <div className="total-bar compact">
          <span>Total</span>
          <strong>{formatINR(total)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary btn-compact" type="submit" disabled={busy}>
          {saving ? 'Saving…' : editing ? 'Update' : 'Save spend'}
        </button>
      </form>

      <SavingOverlay
        show={saving}
        label={editing ? 'Updating spend…' : 'Saving spend…'}
      />
      </>
      ) : null}
    </div>
  )
}
