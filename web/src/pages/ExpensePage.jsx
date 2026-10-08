import { useEffect, useMemo, useState } from 'react'
import { addExpense } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, formatINR, todayISO } from '../lib/format'
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
  const lowerMap = Object.fromEntries(
    Object.entries(categories || {}).map(([k, v]) => [String(k).toLowerCase(), v]),
  )
  EXPENSE_CATEGORIES.forEach((c) => {
    const v = categories[c] ?? lowerMap[c.toLowerCase()]
    next[c] = v === 0 || v === '' || v == null ? '' : String(v)
  })
  return next
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
  const [date, setDate] = useState(todayISO())
  const [categories, setCategories] = useState(emptyCats)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [catOrder, setCatOrder] = useState(() => orderedCategories())
  const [pins, setPins] = useState(() => getPinnedCategories())
  const [noteHints, setNoteHints] = useState(() => getRecentNotes())
  const { data: existing, loading, refreshing, error: loadError } = useEntry('expense', date)

  const total = useMemo(
    () =>
      EXPENSE_CATEGORIES.reduce((sum, c) => {
        const n = Number(categories[c])
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [categories],
  )

  // Prefill as soon as entry data for THIS date is available (don't wait out loading if cache hit)
  useEffect(() => {
    setStatus(null)
    if (!existing || (existing.date && existing.date !== date)) {
      // Date changed / no data yet — clear so we don't flash another day's values
      if (!loading) {
        setCategories(emptyCats())
        setNote('')
      }
      return
    }
    if (existing.found) {
      setCategories(catsFromEntry(existing.categories))
      setNote(existing.note || '')
    } else if (!loading && !refreshing) {
      setCategories(emptyCats())
      setNote('')
    }
  }, [existing, date, loading, refreshing])

  useEffect(() => {
    if (loadError) setStatus({ type: 'error', message: loadError })
  }, [loadError])

  function setCat(name, value) {
    setCategories((prev) => ({ ...prev, [name]: value }))
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
      const used = primaryCategory(categories)
      if (used) {
        setLastUsedCategory(used)
        setCatOrder(orderedCategories())
      }
      const verb = data.updated ? 'Updated' : 'Saved'
      setStatus({
        type: 'ok',
        message: data.demo ? `Demo · ${formatINR(total)}` : `${verb} · ${formatINR(data.total ?? total)}`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !(loading && !matched))
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  return (
    <div className="page fade-in">
      <header className="page-head">
        <h1>{editing ? 'Edit spend' : 'Add spend'}</h1>
        <p className="lede">Amounts by category · pin favorites with ★</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <DateField value={date} onChange={setDate} disabled={busy} />
        <EntryModeBanner
          loading={loadingEntry || (refreshing && !matched)}
          existing={matched ? existing : null}
          label="spend"
        />

        <div className={`cat-grid ${loadingEntry ? 'is-dim' : ''}`}>
          {catOrder.map((c) => {
            const pinned = pins.includes(c)
            return (
              <div key={c} className={`cat-field ${pinned ? 'is-pinned' : ''}`}>
                <div className="cat-field-top">
                  <span className="field-label">{CATEGORY_LABELS[c] || c}</span>
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
                  onChange={(e) => setCat(c, e.target.value)}
                />
              </div>
            )
          })}
        </div>

        <Field label="Note" hint="Optional item breakdown">
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

        <div className="total-bar">
          <span>Total</span>
          <strong>{formatINR(total)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary" type="submit" disabled={busy}>
          {saving ? 'Please wait…' : editing ? 'Update spend' : 'Confirm'}
        </button>
      </form>

      <SavingOverlay
        show={saving}
        label={editing ? 'Updating spend…' : 'Saving spend…'}
      />
    </div>
  )
}
