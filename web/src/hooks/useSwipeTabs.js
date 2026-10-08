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
 * Horizontal swipe with live drag + slide animation between bottom-nav tabs.
 * Swipe left → next tab · swipe right → previous tab.
 */
export function useSwipeTabs() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  const pendingEnter = useRef(null) // 'from-right' | 'from-left' | null
  pathRef.current = pathname

  // Slide the new page in after a committed swipe navigation.
  useEffect(() => {
    const el = ref.current
    if (!el || !pendingEnter.current) return undefined

    const dir = pendingEnter.current
    pendingEnter.current = null
    const width = el.getBoundingClientRect().width || window.innerWidth
    const from = dir === 'from-right' ? width : -width

    el.style.transition = 'none'
    el.style.transform = `translate3d(${from}px,0,0)`
    void el.offsetWidth
    el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.transform = 'translate3d(0,0,0)'

    const clear = () => {
      el.style.transition = ''
      el.style.transform = ''
    }
    el.addEventListener('transitionend', clear, { once: true })
    const t = window.setTimeout(clear, 360)
    return () => {
      clearTimeout(t)
      el.removeEventListener('transitionend', clear)
    }
  }, [pathname])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    let startX = 0
    let startY = 0
    let tracking = false
    let axis = null // 'x' | 'y' | null
    let lastDx = 0
    let animating = false

    const idxOf = () => TAB_PATHS.indexOf(pathRef.current)

    const setX = (x, withTransition) => {
      el.style.transition = withTransition
        ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none'
      el.style.transform = Math.abs(x) < 0.5 ? 'translate3d(0,0,0)' : `translate3d(${x}px,0,0)`
    }

    const rubberDx = (dx) => {
      const idx = idxOf()
      const atStart = idx <= 0
      const atEnd = idx >= TAB_PATHS.length - 1
      if ((dx > 0 && atStart) || (dx < 0 && atEnd)) return dx * 0.28
      return dx
    }

    const onStart = (e) => {
      if (animating) return
      const t = e.touches?.[0]
      if (!t || shouldIgnoreTarget(e.target)) {
        tracking = false
        axis = null
        return
      }
      startX = t.clientX
      startY = t.clientY
      lastDx = 0
      tracking = true
      axis = null
      el.style.transition = 'none'
    }

    const onMove = (e) => {
      if (!tracking || animating) return
      const t = e.touches?.[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y'
        if (axis === 'y') {
          tracking = false
          return
        }
      }
      if (axis !== 'x') return

      lastDx = rubberDx(dx)
      setX(lastDx, false)
      if (e.cancelable) e.preventDefault()
    }

    const finishNavigate = (nextPath, exitX, enterDir) => {
      animating = true
      pendingEnter.current = enterDir
      setX(exitX, true)

      const go = () => {
        navigate(nextPath, { replace: true })
        window.setTimeout(() => {
          animating = false
        }, 340)
      }

      const onEnded = (ev) => {
        if (ev.propertyName && ev.propertyName !== 'transform') return
        el.removeEventListener('transitionend', onEnded)
        go()
      }
      el.addEventListener('transitionend', onEnded)
      window.setTimeout(() => {
        el.removeEventListener('transitionend', onEnded)
        if (animating && pendingEnter.current) go()
      }, 300)
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (axis !== 'x' || animating) {
        axis = null
        setX(0, true)
        return
      }
      axis = null

      const dx = lastDx
      const width = el.getBoundingClientRect().width || window.innerWidth
      const idx = idxOf()
      const committed = Math.abs(dx) >= Math.min(56, width * 0.18)

      if (committed && dx < 0 && idx < TAB_PATHS.length - 1) {
        finishNavigate(TAB_PATHS[idx + 1], -width, 'from-right')
        return
      }
      if (committed && dx > 0 && idx > 0) {
        finishNavigate(TAB_PATHS[idx - 1], width, 'from-left')
        return
      }

      setX(0, true)
      const clear = () => {
        el.style.transition = ''
        el.style.transform = ''
      }
      el.addEventListener('transitionend', clear, { once: true })
      window.setTimeout(clear, 300)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [navigate])

  return ref
}
