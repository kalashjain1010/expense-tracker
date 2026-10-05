import { useCallback } from 'react'
import { fetchEntry, fetchMonthDetail, fetchSummary } from '../lib/api'
import { useCachedQuery } from './useCachedQuery'
import { entryKey, monthDetailKey, prefetch, summaryKey } from '../lib/queryCache'
import { todayISO } from '../lib/format'

export function useSummary() {
  const fetcher = useCallback(() => fetchSummary(), [])
  return useCachedQuery(summaryKey(), fetcher)
}

export function useEntry(type, date) {
  const key = date ? entryKey(type, date) : null
  const fetcher = useCallback(() => fetchEntry(type, date), [type, date])
  return useCachedQuery(key, fetcher, { enabled: Boolean(date) })
}

export function useMonthDetail(month) {
  const key = month ? monthDetailKey(month) : null
  const fetcher = useCallback(() => fetchMonthDetail(month), [month])
  return useCachedQuery(key, fetcher, { enabled: Boolean(month) })
}

/**
 * Warm today's Spend / Income / Card entry lookups in parallel.
 * Safe to call repeatedly — joins inflight or skips if fresh.
 */
export function prefetchTodayEntries() {
  const date = todayISO()
  const types = ['expense', 'income', 'credit']
  return Promise.all(
    types.map((type) =>
      prefetch(entryKey(type, date), () => fetchEntry(type, date)),
    ),
  )
}
