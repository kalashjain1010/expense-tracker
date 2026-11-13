import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addIncome } from '../lib/api'
import { useEntry } from '../hooks/useKharchaData'
import DateField from '../components/DateField'
import EntryModeBanner from '../components/EntryModeBanner'
import Field, { SavingOverlay, StatusBanner } from '../components/Field'
import ModeSwitch from '../components/ModeSwitch'
import MonthTotalChip from '../components/MonthTotalChip'
import TabMonthView from '../components/TabMonthView'
import { clampISOToToday, formatINR, todayISO } from '../lib/format'

function initialDateFromUrl(params) {
  const raw = params.get('date')
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayISO()
  return clampISOToToday(raw)
}

export default function IncomePage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState(() => (searchParams.get('view') === 'month' ? 'month' : 'log'))
  const [date, setDate] = useState(() => initialDateFromUrl(searchParams))
  const [kalash, setKalash] = useState('')
  const [mummy, setMummy] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const { data: existing, loading, refreshing, error: loadError } = useEntry('income', date)

  useEffect(() => {
    setDate(initialDateFromUrl(searchParams))
    if (searchParams.get('view') === 'month') setMode('month')
  }, [searchParams])

  const total = useMemo(() => (Number(kalash) || 0) + (Number(mummy) || 0), [kalash, mummy])
  const matched = Boolean(existing && (!existing.date || existing.date === date))
  const editing = Boolean(matched && existing.found && !loading)
  const loadingEntry = loading && !matched
  const busy = saving || loadingEntry

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

  return (
    <div className={`page entry-page entry-${mode} fade-in`}>
      <header className="page-head page-head-row">
        <div>
          <h1>{mode === 'month' ? 'Income' : editing ? 'Edit income' : 'Income'}</h1>
          <p className="lede">{mode === 'month' ? 'This month’s days' : 'Kalash · Mummy · source'}</p>
        </div>
        <ModeSwitch value={mode} onChange={setMode} monthLabel="Month" />
      </header>

      {mode === 'month' ? <TabMonthView kind="income" /> : null}

      {mode === 'log' ? (
      <>
      <MonthTotalChip kind="income" />
      <form className="form form-compact" onSubmit={onSubmit}>
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

        <div className="total-bar compact">
          <span>Total</span>
          <strong>{formatINR(total)}</strong>
        </div>

        <StatusBanner status={status} />

        <button className="btn primary btn-compact" type="submit" disabled={busy}>
          {saving ? 'Saving…' : editing ? 'Update' : 'Save income'}
        </button>
      </form>

      <SavingOverlay
        show={saving}
        label={editing ? 'Updating income…' : 'Saving income…'}
      />
      </>
      ) : null}
    </div>
  )
}

function entryStr(v) {
  return v === '' || v == null ? '' : String(v)
}
