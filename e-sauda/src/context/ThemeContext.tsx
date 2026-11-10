import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'e-sauda:theme'

interface ThemeValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark is the dominant theme, so it's the default whenever there's no
  // stored preference yet -- this deliberately does NOT look at
  // prefers-color-scheme, since the brief was "dark by default", not
  // "whatever the OS says".
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // Ignore -- private browsing / storage disabled. Falls through to dark.
    }
    return 'dark'
  })

  // The actual switch: index.css only defines an override for
  // [data-theme="light"] (dark is what :root already is), so this attribute
  // is the entire mechanism -- no class toggling, no JS-computed colors.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore -- worst case the choice doesn't persist across reloads.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  // Falls back to a harmless dark/no-op rather than throwing -- a missing
  // provider shouldn't be what crashes the page over a theme toggle.
  return ctx ?? { theme: 'dark', toggleTheme: () => {} }
}
