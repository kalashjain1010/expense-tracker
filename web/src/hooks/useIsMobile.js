import { useEffect, useState } from 'react'

function useMedia(query, defaultValue = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return defaultValue
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])

  return matches
}

/** Phones / small tablets — lock screen numpad, etc. */
export function useIsMobile() {
  return useMedia('(max-width: 820px), (pointer: coarse)', true)
}

/** Laptop / desktop layout (≥900px wide). */
export function useIsDesktop() {
  return useMedia('(min-width: 900px)', false)
}
