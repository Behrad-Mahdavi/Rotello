'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('rotello-theme') as Theme | null
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored)
        applyTheme(stored)
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const initial = prefersDark ? 'dark' : 'light'
        setThemeState(initial)
        applyTheme(initial)
      }
    } catch {
      // fallback
    }
    setMounted(true)
  }, [])

  function applyTheme(newTheme: Theme) {
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
    applyTheme(newTheme)
    try {
      localStorage.setItem('rotello-theme', newTheme)
    } catch {
      // fallback
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : 'light', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
