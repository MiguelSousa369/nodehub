import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Light / dark theme, shared by the whole app.
//
// The choice ("system", "light" or "dark") is kept in localStorage under "theme". Dark mode is the
// `dark` class on <html> (Tailwind darkMode: 'class'). public/theme-init.js applies it before the first paint,
// so there is no flash of the wrong theme; this provider keeps it in sync afterwards, including
// following the OS setting live while the choice is "system".
// ---------------------------------------------------------------------------

export type ThemeChoice = 'system' | 'light' | 'dark'

interface ThemeState {
  theme   : ThemeChoice
  setTheme: (choice: ThemeChoice) => void
}

const STORAGE_KEY = 'theme'
const ThemeContext = createContext<ThemeState | null>(null)
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setChoice] = useState<ThemeChoice>(readChoice)

  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return
    const mq = media()
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch { /* storage blocked: the choice lasts until the page is reloaded */ }
    setChoice(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
