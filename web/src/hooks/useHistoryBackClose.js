import { useEffect, useRef } from 'react'

/**
 * While `active`, hardware/browser Back runs `onClose` (e.g. leave month days).
 * Call the returned `requestClose` from the UI back button so history stays clean.
 * Tab navigations should use `replace` so they don't stack under this.
 */
export function useHistoryBackClose(active, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const openRef = useRef(false)

  useEffect(() => {
    if (!active) {
      openRef.current = false
      return undefined
    }

    openRef.current = true
    window.history.pushState({ __expenseOverlay: true }, '')

    const onPop = () => {
      openRef.current = false
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      openRef.current = false
    }
  }, [active])

  function requestClose() {
    if (window.history.state?.__expenseOverlay) {
      window.history.back()
      return
    }
    onCloseRef.current()
  }

  return requestClose
}
