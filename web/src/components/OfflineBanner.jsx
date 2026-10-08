import { useCallback, useEffect, useState } from 'react'
import { flushQueue, queueCount, subscribeQueue } from '../lib/offlineQueue'
import { addCreditCard, addExpense, addIncome } from '../lib/api'

/** Banner + sync for offline-queued sheet writes. */
export default function OfflineBanner() {
  const [count, setCount] = useState(() => queueCount())
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [msg, setMsg] = useState('')

  useEffect(() => subscribeQueue((list) => setCount(list.length)), [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const sync = useCallback(async () => {
    if (syncing || !navigator.onLine) return
    setSyncing(true)
    setMsg('')
    try {
      const result = await flushQueue({
        expense: (payload) => addExpense(payload, { allowQueue: false }),
        income: (payload) => addIncome(payload, { allowQueue: false }),
        credit: (payload) => addCreditCard(payload, { allowQueue: false }),
      })
      if (result.synced > 0 && result.remaining === 0) {
        setMsg(`Synced ${result.synced} save${result.synced === 1 ? '' : 's'}`)
      } else if (result.synced > 0) {
        setMsg(`Synced ${result.synced} · ${result.remaining} still waiting`)
      } else if (result.remaining > 0) {
        setMsg('Still offline or sheet busy — try again soon')
      }
    } catch {
      setMsg('Sync failed — try again')
    } finally {
      setSyncing(false)
      setCount(queueCount())
    }
  }, [syncing])

  // Auto-flush when connectivity returns
  useEffect(() => {
    if (online && count > 0) sync()
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!count && !msg && online) return null

  return (
    <div className={`offline-banner ${!online ? 'is-offline' : ''}`} role="status">
      <div className="offline-banner-text">
        {!online ? (
          <span>You’re offline{count ? ` · ${count} save${count === 1 ? '' : 's'} queued` : ''}</span>
        ) : count > 0 ? (
          <span>
            {count} save{count === 1 ? '' : 's'} waiting to reach your sheet
          </span>
        ) : (
          <span>{msg}</span>
        )}
        {msg && count > 0 ? <span className="offline-banner-sub">{msg}</span> : null}
      </div>
      {count > 0 ? (
        <button type="button" className="offline-sync-btn" disabled={syncing || !online} onClick={sync}>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      ) : null}
    </div>
  )
}
