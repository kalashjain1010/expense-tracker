import { useEffect, useState } from 'react'
import { addCreditCard } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import { useSwipeDate } from '../hooks/useSwipeDate'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import QuickAmounts from '../components/QuickAmounts'
import { formatINR, todayISO } from '../lib/format'

export default function CreditPage() {
  const [date, setDate] = useState(todayISO())
  const [total, setTotal] = useState('')
  const [items, setItems] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const { data: existing, loading, refreshing, error: loadError } = useEntry('credit', date)
  const swipeRef = useSwipeDate(date, setDate, { disabled: saving })

  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !(loading && !matched))
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  useEffect(() => {
    setStatus(null)
    if (!existing || (existing.date && existing.date !== date)) {
      if (!loading) {
        setTotal('')
        setItems('')
      }
      return
    }
    if (existing.found) {
      setTotal(existing.total === '' || existing.total == null ? '' : String(existing.total))
      setItems(existing.items || '')
    } else if (!loading && !refreshing) {
      setTotal('')
      setItems('')
    }
  }, [existing, date, loading, refreshing])

  useEffect(() => {
    if (loadError) setStatus({ type: 'error', message: loadError })
  }, [loadError])

  function addAmount(amount) {
    setTotal(String((Number(total) || 0) + amount))
  }

  async function onSubmit(e) {
    e.preventDefault()
    const amount = Number(total) || 0
    if (amount <= 0) {
      setStatus({ type: 'error', message: 'Enter a total amount.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const data = await addCreditCard({ date, total: amount, items })
      if (data.queued) {
        setStatus({
          type: 'ok',
          message: `Saved offline · ${formatINR(data.total ?? amount)} — syncs when you’re back online`,
        })
      } else {
        const verb = data.updated ? 'Updated' : 'Saved'
        setStatus({
          type: 'ok',
          message: `${verb} · ${formatINR(data.total ?? amount)}`,
        })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page fade-in" ref={swipeRef}>
      <header className="page-head">
        <h1>{editing ? 'Edit credit card' : 'Credit card'}</h1>
        <p className="lede">Swipe left/right to change day.</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <DateField value={date} onChange={setDate} disabled={busy} />
        <EntryModeBanner
          loading={loadingEntry || (refreshing && !matched)}
          existing={matched ? existing : null}
          label="card spend"
        />

        <Field label="Total">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="—"
            value={total}
            disabled={busy}
            onChange={(e) => setTotal(e.target.value)}
            required
          />
        </Field>

        <QuickAmounts disabled={busy} label="Quick add to total" onAdd={addAmount} />

        <Field label="Items" hint="e.g. Fridge – 17500, Gyser – 3500">
          <textarea
            rows={3}
            value={items}
            disabled={busy}
            onChange={(e) => setItems(e.target.value)}
            placeholder="Item – amount…"
          />
        </Field>

        <div className="total-bar">
          <span>Total</span>
          <strong>{formatINR(Number(total) || 0)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary" type="submit" disabled={busy}>
          {saving ? 'Please wait…' : editing ? 'Update card' : 'Confirm'}
        </button>
      </form>

      <SavingOverlay
        show={saving}
        label={editing ? 'Updating card spend…' : 'Saving card spend…'}
      />
    </div>
  )
}
