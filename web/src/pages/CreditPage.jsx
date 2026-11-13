import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addCreditCard } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import CreditOutstanding from '../components/CreditOutstanding'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import ModeSwitch from '../components/ModeSwitch'
import QuickAmounts from '../components/QuickAmounts'
import TabMonthView from '../components/TabMonthView'
import { clampISOToToday, formatINR, todayISO } from '../lib/format'

function initialDateFromUrl(params) {
  const raw = params.get('date')
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayISO()
  return clampISOToToday(raw)
}

export default function CreditPage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(() => (searchParams.get('view') === 'month' ? 'month' : 'log'))
  const [date, setDate] = useState(() => initialDateFromUrl(searchParams))
  const [total, setTotal] = useState('')
  const [items, setItems] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const totalRef = useRef(null)
  const { data: existing, loading, refreshing, error: loadError } = useEntry('credit', date)

  useEffect(() => {
    setDate(initialDateFromUrl(searchParams))
    if (searchParams.get('view') === 'month') setMode('month')
  }, [searchParams])

  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !loading)
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  useEffect(() => {
    setTotal('')
    setItems('')
    setStatus(null)
  }, [date])

  useEffect(() => {
    if (loading) return
    if (!existing) return
    if (existing.date && existing.date !== date) return
    if (existing.found) {
      setTotal(existing.total === '' || existing.total == null ? '' : String(existing.total))
      setItems(existing.items || '')
    } else {
      setTotal('')
      setItems('')
    }
  }, [existing, date, loading])

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
          message: data.demo ? `Demo · ${formatINR(amount)}` : `${verb} · ${formatINR(data.total ?? amount)}`,
        })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`page entry-page entry-${mode} credit-page fade-in`}>
      <header className="page-head page-head-row">
        <div>
          <h1>{mode === 'month' ? 'Card' : editing ? 'Edit charge' : 'Card'}</h1>
          <p className="lede">{mode === 'month' ? 'This month’s charges' : 'Log a charge'}</p>
        </div>
        <ModeSwitch value={mode} onChange={setMode} monthLabel="Month" />
      </header>

      <CreditOutstanding />

      {mode === 'month' ? <TabMonthView kind="credit" /> : null}

      {mode === 'log' ? (
        <>
          <form className="form form-compact" onSubmit={onSubmit}>
            <DateField value={date} onChange={setDate} disabled={busy} />
            <EntryModeBanner
              loading={loadingEntry || (refreshing && !matched)}
              existing={matched ? existing : null}
              label="card spend"
            />

            <Field label="Amount">
              <input
                ref={totalRef}
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

            <QuickAmounts disabled={busy} label="Quick add" onAdd={addAmount} />

            <Field label="Items" hint="Optional">
              <textarea
                rows={2}
                value={items}
                disabled={busy}
                onChange={(e) => setItems(e.target.value)}
                placeholder="What did you buy…"
              />
            </Field>

            <div className="total-bar compact">
              <span>Total</span>
              <strong>{formatINR(Number(total) || 0)}</strong>
            </div>

            <StatusBanner status={status} />

            <button className="btn primary btn-compact" type="submit" disabled={busy}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Save charge'}
            </button>
          </form>

          <SavingOverlay
            show={saving}
            label={editing ? 'Updating card spend…' : 'Saving card spend…'}
          />
        </>
      ) : null}
    </div>
  )
}
