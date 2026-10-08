import { useEffect } from 'react'

/** Focus a PIN field on mount (and when the tab becomes visible) so mobile keyboards open. */
export function useAutoFocusPin(inputRef, deps = []) {
  useEffect(() => {
    const focusPin = () => {
      const input = inputRef.current
      if (!input || input.disabled) return
      try {
        input.focus({ preventScroll: true })
        const n = input.value?.length ?? 0
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(n, n)
        }
      } catch {
        input.focus()
      }
    }

    focusPin()
    const raf = requestAnimationFrame(focusPin)
    const timers = [0, 80, 250, 500].map((ms) => window.setTimeout(focusPin, ms))

    const onShow = () => {
      if (document.visibilityState === 'visible') focusPin()
    }
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onShow)

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps)
}
