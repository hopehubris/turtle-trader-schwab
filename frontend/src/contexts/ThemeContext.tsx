import React, { createContext, useContext, useState } from 'react'

export type AppTheme = 'classic' | 'terminal'

interface ThemeContextType {
  theme: AppTheme
  setView: (t: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'terminal', setView: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(
    () => (localStorage.getItem('tt-theme') as AppTheme) ?? 'terminal'
  )
  function setView(next: AppTheme) { setTheme(next); localStorage.setItem('tt-theme', next) }
  return <ThemeContext.Provider value={{ theme, setView }}>{children}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
