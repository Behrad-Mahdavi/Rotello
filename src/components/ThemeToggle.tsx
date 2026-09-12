'use client'

import React from 'react'
import { useTheme } from './ThemeProvider'

interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
      title={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/70 text-subtle transition-all duration-200 hover:bg-surface hover:text-default hover:border-action/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-action ${className}`}
    >
      {/* Sun Icon for Dark Mode (click to turn Light) */}
      <svg
        className={`h-4 w-4 transition-all duration-300 ${
          theme === 'dark'
            ? 'rotate-0 scale-100 opacity-100 text-amber-400'
            : '-rotate-90 scale-0 opacity-0 absolute text-amber-500'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        />
      </svg>

      {/* Moon Icon for Light Mode (click to turn Dark) */}
      <svg
        className={`h-4 w-4 transition-all duration-300 ${
          theme === 'light'
            ? 'rotate-0 scale-100 opacity-100 text-slate-700'
            : 'rotate-90 scale-0 opacity-0 absolute text-slate-300'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
        />
      </svg>
    </button>
  )
}
