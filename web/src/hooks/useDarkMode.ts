import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('darkMode') === 'true')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('darkMode', String(dark))
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}
