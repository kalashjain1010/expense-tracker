import { useEffect, useMemo, useState } from 'react'
import { addIncome } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import { formatINR, todayISO } from '../lib/format'

export default function IncomePage() {
  const [date, setDate] = useState(todayISO())
  const [kalash, setKalash] = useState('')
  const [mummy, setMummy] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const { data: existing, loading, refreshing, error: loadError } = useEntry('income', date)

  const total = useMemo(() => (Number(kalash) || 0) + (Number(mummy) || 0), [kalash, mummy])
  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !loading)
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  // Clear fields as soon as the date changes so we never show another day's values
  useEffect(() => {
    setKalash('')
    setMummy('')
    setSource('')
    setStatus(null)
  }, [date])

  useEffect(() => {
    if (loading) return
    if (!existing) return
    if (existing.date && existing.date !== date) return
    if (existing.found) {
      setKalash(entryStr(existing.kalash))
      setMummy(entryStr(existing.mummy))
      setSource(existing.source || '')
    } else {
      setKalash('')
      setMummy('')
      setSource('')
    }
  }, [existing, date, loading])

  useEffect(() => {
    if (loadError) setStatus({ type: 'error', message: loadError })
  }, [loadError])

  async function onSubmit(e) {
    e.preventDefault()
    if (total <= 0) {
      setStatus({ type: 'error', message: 'Enter Kalash and/or Mummy amount.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const data = await addIncome({ date, kalash, mummy, source })
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

  return (
    <div className="page fade-in">
      <header className="page-head">
        <h1>{editing ? 'Edit income' : 'Add income'}</h1>
        <p className="lede">Pick a date — existing data loads automatically.</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <DateField value={date} onChange={setDate} disabled={busy} />
        <EntryModeBanner
          loading={loadingEntry || (refreshing && !matched)}
          existing={matched ? existing : null}
          label="income"
        />

        <div className={`cat-grid ${loadingEntry ? 'is-dim' : ''}`}>
          <Field label="Kalash">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="—"
              value={kalash}
              disabled={busy}
              onChange={(e) => setKalash(e.target.value)}
            />
          </Field>
          <Field label="Mummy">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="—"
              value={mummy}
              disabled={busy}
              onChange={(e) => setMummy(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Source">
          <input
            type="text"
            value={source}
            disabled={busy}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Salary, rent…"
          />
        </Field>

        <div className="total-bar">
          <span>Total</span>
          <strong>{formatINR(total)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary" type="submit" disabled={busy}>
          {saving ? 'Please wait…' : editing ? 'Update income' : 'Confirm'}
        </button>
      </form>

      <SavingOverlay
        show={saving}
        label={editing ? 'Updating income…' : 'Saving income…'}
      />
    </div>
  )
}

function entryStr(v) {
  return v === '' || v == null ? '' : String(v)
}
