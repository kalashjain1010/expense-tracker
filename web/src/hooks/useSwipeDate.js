import { useEffect, useRef } from 'react'
import { clampISOToToday, shiftISO, todayISO } from '../lib/format'

/**
 * Horizontal swipe on an element shifts the active date.
 * Swipe right → older day · swipe left → newer day (capped at today).
 */
export function useSwipeDate(date, setDate, { disabled = false } = {}) {
  const ref = useRef(null)
  const dateRef = useRef(date)
  dateRef.current = date

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return undefined

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e) => {
      const t = e.touches?.[0]
      if (!t) return
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }

    const onEnd = (e) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches?.[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.abs(dx) < 64) return
      if (Math.abs(dx) < Math.abs(dy) * 1.25) return

      const cur = dateRef.current
      if (dx > 0) {
        setDate(clampISOToToday(shiftISO(cur, -1)))
      } else {
        const next = shiftISO(cur, 1)
        if (next <= todayISO()) setDate(next)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [disabled, setDate])

  return ref
}
