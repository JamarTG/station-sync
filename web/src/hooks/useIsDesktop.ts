import { useState, useEffect } from 'react'

export function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [px])

  return matches
}
