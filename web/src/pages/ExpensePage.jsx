import { useEffect, useMemo, useState } from 'react'
import { addExpense } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import QuickAmounts from '../components/QuickAmounts'
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
  const [focusCat, setFocusCat] = useState(() => orderedCategories()[0] || EXPENSE_CATEGORIES[0])
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

  useEffect(() => {
    setStatus(null)
    if (!existing || (existing.date && existing.date !== date)) {
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
          message: `${verb} · ${formatINR(data.total ?? total)}`,
        })
      }
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
        <p className="lede">Swipe tabs · swipe date row for days · pin with ★</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
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
                  onFocus={() => setFocusCat(c)}
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
