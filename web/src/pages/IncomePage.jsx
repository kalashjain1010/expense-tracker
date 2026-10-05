import { useEffect, useMemo, useState } from 'react'
import { addIncome } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import { formatINR, todayISO } from '../lib/format'

export default function IncomePage() {
  const [date, setDate] = useState(todayISO())
  const [you, setYou] = useState('')
  const [partner, setPartner] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const { data: existing, loading, refreshing, error: loadError } = useEntry('income', date)

  const total = useMemo(() => (Number(you) || 0) + (Number(partner) || 0), [you, partner])
  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !(loading && !matched))
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

  useEffect(() => {
    setStatus(null)
    if (!existing || (existing.date && existing.date !== date)) {
      if (!loading) {
        setYou('')
        setPartner('')
        setSource('')
      }
      return
    }
    if (existing.found) {
      setYou(entryStr(existing.you ?? existing.kalash))
      setPartner(entryStr(existing.partner ?? existing.mummy))
      setSource(existing.source || '')
    } else if (!loading && !refreshing) {
      setYou('')
      setPartner('')
      setSource('')
    }
  }, [existing, date, loading, refreshing])

  useEffect(() => {
    if (loadError) setStatus({ type: 'error', message: loadError })
  }, [loadError])

  async function onSubmit(e) {
    e.preventDefault()
    if (total <= 0) {
      setStatus({ type: 'error', message: 'Enter at least one amount.' })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const data = await addIncome({ date, you, partner, source })
      const verb = data.updated ? 'Updated' : 'Saved'
      setStatus({
        type: 'ok',
        message: `${verb} · ${formatINR(data.total ?? total)}`,
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
        <p className="lede">Salary, rent, gifts — pick a date and fill what applies.</p>
      </header>

      <form className="form" onSubmit={onSubmit}>
        <DateField value={date} onChange={setDate} disabled={busy} />
        <EntryModeBanner
          loading={loadingEntry || (refreshing && !matched)}
          existing={matched ? existing : null}
          label="income"
        />

        <div className={`cat-grid ${loadingEntry ? 'is-dim' : ''}`}>
          <Field label="You">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="—"
              value={you}
              disabled={busy}
              onChange={(e) => setYou(e.target.value)}
            />
          </Field>
          <Field label="Partner / other">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="—"
              value={partner}
              disabled={busy}
              onChange={(e) => setPartner(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Source">
          <input
            type="text"
            value={source}
            disabled={busy}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Salary, rent, freelance…"
          />
        </Field>

        <div className="total-bar">
          <span>Total</span>
          <strong>{formatINR(total)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary" type="submit" disabled={busy}>
          {saving ? 'Please wait…' : editing ? 'Update income' : 'Save income'}
        </button>
      </form>

      <SavingOverlay show={saving} label={editing ? 'Updating income…' : 'Saving income…'} />
    </div>
  )
}

function entryStr(v) {
  return v === '' || v == null ? '' : String(v)
}
