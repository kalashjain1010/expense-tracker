import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CACHE_HARD_TTL_MS,
  CACHE_SOFT_TTL_MS,
  cachedQuery,
  hasInflight,
  isFresh,
  isUsable,
  peek,
  subscribe,
} from '../lib/queryCache'

function initialLoading(key, enabled) {
  if (!enabled || !key) return false
  if (isUsable(peek(key), CACHE_HARD_TTL_MS)) return false
  return true // cold or already in-flight from another screen / prefetch
}

/**
 * Instant cache paint + background refresh when stale.
 * Tab switches remount pages; in-flight fetches are never cancelled —
 * remounting joins the same promise and keeps the loading state until real data arrives.
 */
export function useCachedQuery(key, fetcher, { softTtl = CACHE_SOFT_TTL_MS, enabled = true } = {}) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  const mountedRef = useRef(true)

  const readUsable = (k) => {
    if (!enabled || !k) return null
    const entry = peek(k)
    return isUsable(entry, CACHE_HARD_TTL_MS) ? entry.data : null
  }

  const [data, setData] = useState(() => readUsable(key))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(() => initialLoading(key, enabled))
  const [refreshing, setRefreshing] = useState(() => Boolean(key && hasInflight(key) && readUsable(key)))

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const safeSet = useCallback((fn) => {
    if (mountedRef.current) fn()
  }, [])

  const run = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled || !key) return null
      const requestKey = key
      const cached = peek(requestKey)
      const usable = isUsable(cached, CACHE_HARD_TTL_MS)
      const fresh = isFresh(cached, softTtl)

      if (usable) {
        safeSet(() => {
          setData(cached.data)
          setLoading(false)
        })
        if (!force && fresh) return cached.data
        safeSet(() => setRefreshing(true))
      } else {
        safeSet(() => {
          setLoading(true)
          setRefreshing(false)
        })
      }

      try {
        const result = await cachedQuery(requestKey, () => fetcherRef.current(), { force, softTtl })
        // Ignore if the hook moved to a different key (date change) while awaiting
        if (keyRef.current !== requestKey) return result.data
        safeSet(() => {
          setData(result.data)
          setError('')
          setLoading(false)
          setRefreshing(false)
        })
        return result.data
      } catch (err) {
        if (keyRef.current !== requestKey) throw err
        safeSet(() => {
          if (!usable) {
            setError(err.message || 'Failed to load')
            setData(null)
          }
          setLoading(false)
          setRefreshing(false)
        })
        throw err
      }
    },
    [enabled, key, softTtl, safeSet],
  )

  // When the cache key changes (e.g. date), paint that key's cache immediately — never keep prior key's data
  useEffect(() => {
    if (!enabled || !key) {
      setData(null)
      setError('')
      setLoading(false)
      setRefreshing(false)
      return
    }
    const cachedData = readUsable(key)
    setData(cachedData)
    setError('')
    setLoading(!cachedData)
    setRefreshing(Boolean(cachedData && hasInflight(key)))
  }, [key, enabled])

  useEffect(() => {
    if (!enabled || !key) return undefined
    run().catch(() => {
      /* surfaced via error state */
    })
    // Do NOT cancel the network on unmount — cachedQuery keeps the inflight promise.
    return undefined
  }, [run, enabled, key])

  // Re-read when another screen writes / invalidates / prefetch completes
  useEffect(() => {
    return subscribe((changedKey) => {
      if (!key) return
      const matches =
        changedKey === 'mutation' ||
        changedKey === key ||
        (typeof changedKey === 'string' && key.startsWith(`${changedKey}`))
      if (!matches) return

      const cached = peek(key)
      if (isUsable(cached, CACHE_HARD_TTL_MS)) {
        safeSet(() => {
          setData(cached.data)
          setLoading(false)
          setRefreshing(hasInflight(key))
          setError('')
        })
      } else if (hasInflight(key)) {
        safeSet(() => {
          setLoading(true)
          setRefreshing(false)
        })
      } else if (changedKey === 'mutation') {
        run({ force: true }).catch(() => {})
      }
    })
  }, [key, run, safeSet])

  // Soft refresh when app returns to foreground after being stale
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !key) return
      const cached = peek(key)
      if (!isFresh(cached, softTtl)) run({ force: false }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [key, run, softTtl])

  return {
    data,
    error,
    loading,
    refreshing,
    refetch: () => run({ force: true }),
  }
}
