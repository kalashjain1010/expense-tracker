import { useLayoutEffect } from 'react'

export function focusPinInput(input) {
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

/**
 * Focus PIN on first paint (same path as after tapping Lock).
 * useLayoutEffect runs before paint so mobile keyboards can open when allowed.
 */
export function useAutoFocusPin(inputRef, deps = []) {
  useLayoutEffect(() => {
    const focusPin = () => focusPinInput(inputRef.current)

    focusPin()
    const raf = requestAnimationFrame(focusPin)
    const t = window.setTimeout(focusPin, 0)

    const onShow = () => {
      if (document.visibilityState === 'visible') focusPin()
    }
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onShow)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps)
}
