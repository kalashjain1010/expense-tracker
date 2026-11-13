import { useLayoutEffect } from 'react'

export function focusPinInput(input) {
  if (!input || input.disabled) return false
  try {
    if (input.hasAttribute('readonly')) input.removeAttribute('readonly')
    input.focus({ preventScroll: true })
    const n = input.value?.length ?? 0
    if (typeof input.setSelectionRange === 'function') {
      try {
        input.setSelectionRange(n, n)
      } catch {
        /* ignore */
      }
    }
    // Android Chrome / installed PWA often opens the keyboard on click()
    try {
      input.click()
    } catch {
      /* ignore */
    }
    return document.activeElement === input
  } catch {
    try {
      input.focus()
      return document.activeElement === input
    } catch {
      return false
    }
  }
}

/**
 * Focus PIN after delayMs. On Android installed PWAs, delayed focus+click
 * usually opens the numeric keyboard without an extra tap.
 */
export function useAutoFocusPin(inputRef, deps = [], { delayMs = 500, enabled = true } = {}) {
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const el = inputRef.current
    if (!el) return undefined

    el.removeAttribute('readonly')

    const focusPin = () => focusPinInput(inputRef.current)

    const timers = [delayMs, delayMs + 150, delayMs + 400, delayMs + 800].map((ms) =>
      window.setTimeout(focusPin, ms),
    )

    const onShow = () => window.setTimeout(focusPin, delayMs)
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') window.setTimeout(focusPin, delayMs)
    })

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('pageshow', onShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
