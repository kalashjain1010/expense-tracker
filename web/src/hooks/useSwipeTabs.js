import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const TAB_PATHS = ['/', '/expense', '/income', '/credit']

function shouldIgnoreTarget(target) {
  if (!(target instanceof Element)) return true
  if (target.closest('[data-swipe-date]')) return true
  if (target.closest('.recharts-wrapper')) return true
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true
  return false
}

/**
 * Horizontal swipe on an element switches bottom-nav tabs.
 * Swipe left → next tab · swipe right → previous tab.
 */
export function useSwipeTabs() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e) => {
      const t = e.touches?.[0]
      if (!t || shouldIgnoreTarget(e.target)) {
        tracking = false
        return
      }
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
      if (Math.abs(dx) < 56) return
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return

      const idx = TAB_PATHS.indexOf(pathRef.current)
      if (idx < 0) return

      if (dx < 0 && idx < TAB_PATHS.length - 1) {
        navigate(TAB_PATHS[idx + 1], { replace: true })
      } else if (dx > 0 && idx > 0) {
        navigate(TAB_PATHS[idx - 1], { replace: true })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [navigate])

  return ref
}
