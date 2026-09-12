'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  toJalaali,
  toGregorian,
  jalaaliMonthLength,
  PERSIAN_MONTHS,
  PERSIAN_WEEK_DAYS,
  toPersianDigits,
  parseGregorianToJalaali,
  formatJalaaliToGregorianString,
} from '@/utils/jalaali'
import { X } from 'lucide-react'

interface PersianDatePickerProps {
  value: string // Expects YYYY-MM-DD or empty
  onChange: (dateStr: string) => void // Returns YYYY-MM-DD
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export default function PersianDatePicker({
  value,
  onChange,
  label,
  placeholder = 'انتخاب تاریخ شمسی...',
  disabled = false,
  className = '',
  required = false,
}: PersianDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Today in Jalali
  const todayJalali = useMemo(() => {
    const now = new Date()
    return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }, [])

  // Selected date in Jalali
  const selectedJalali = useMemo(() => {
    return parseGregorianToJalaali(value)
  }, [value])

  // Current calendar view (year and month)
  const [viewYear, setViewYear] = useState<number>(todayJalali.jy)
  const [viewMonth, setViewMonth] = useState<number>(todayJalali.jm)

  // Sync view when opening or when value changes
  useEffect(() => {
    if (selectedJalali) {
      setViewYear(selectedJalali.jy)
      setViewMonth(selectedJalali.jm)
    } else {
      setViewYear(todayJalali.jy)
      setViewMonth(todayJalali.jm)
    }
  }, [selectedJalali, todayJalali, isOpen])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Navigation handlers
  function handlePrevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function handleNextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function handleSelectDay(day: number) {
    const gregorianStr = formatJalaaliToGregorianString(viewYear, viewMonth, day)
    onChange(gregorianStr)
    setIsOpen(false)
  }

  function handleSelectToday() {
    const gregorianStr = formatJalaaliToGregorianString(
      todayJalali.jy,
      todayJalali.jm,
      todayJalali.jd
    )
    onChange(gregorianStr)
    setIsOpen(false)
  }

  function handleClear() {
    onChange('')
    setIsOpen(false)
  }

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const totalDays = jalaaliMonthLength(viewYear, viewMonth)
    // 1st day of month in Gregorian
    const g1 = toGregorian(viewYear, viewMonth, 1)
    const jsDay = new Date(g1.gy, g1.gm - 1, g1.gd).getDay() // 0 is Sun, 6 is Sat
    const startOffset = (jsDay + 1) % 7 // 0=Shanbe, 1=Yekshanbe, ..., 6=Jomeh

    const days: (number | null)[] = []
    for (let i = 0; i < startOffset; i++) {
      days.push(null)
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d)
    }
    return days
  }, [viewYear, viewMonth])

  // Available year range (-5 to +5 years)
  const years = useMemo(() => {
    const list: number[] = []
    const start = todayJalali.jy - 5
    const end = todayJalali.jy + 6
    for (let y = start; y <= end; y++) {
      list.push(y)
    }
    return list
  }, [todayJalali.jy])

  // Display text in input box
  const displayText = useMemo(() => {
    if (!selectedJalali) return ''
    return `${toPersianDigits(selectedJalali.jd)} ${PERSIAN_MONTHS[selectedJalali.jm - 1]} ${toPersianDigits(selectedJalali.jy)}`
  }, [selectedJalali])

  return (
    <div className={`relative ${className}`} ref={containerRef} dir="rtl">
      {label && (
        <label className="block text-xs font-medium text-muted mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Display Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm transition-all cursor-pointer select-none ${
          isOpen ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 bg-surface' : 'hover:border-border-subtle'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`h-4 w-4 shrink-0 transition-colors ${displayText ? 'text-emerald-400' : 'text-muted'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <span className={`truncate text-xs sm:text-sm font-medium ${displayText ? 'text-default font-semibold' : 'text-muted'}`}>
            {displayText || placeholder}
          </span>
        </div>

        {displayText && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-default cursor-pointer"
            title="پاک کردن تاریخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <svg className="h-4 w-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Calendar Popup Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-surface p-4 shadow-2xl animate-in fade-in-50 zoom-in-95">
          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between gap-1 mb-3.5 pb-2.5 border-b border-border/80">
            {/* Prev month button (RTL: right arrow goes to next chronological, but prev month) */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-default transition-colors"
              title="ماه قبل"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs font-bold text-default focus:outline-none focus:border-emerald-500"
              >
                {PERSIAN_MONTHS.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs font-bold text-default focus:outline-none focus:border-emerald-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>

            {/* Next month button */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-default transition-colors"
              title="ماه بعد"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Weekday Labels (شنبه تا جمعه) */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {PERSIAN_WEEK_DAYS.map((wd, i) => (
              <span
                key={i}
                className={`text-[11px] font-bold py-1 ${i === 6 ? 'text-rose-400' : 'text-muted'}`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8 w-8" />
              }

              const isSelected =
                selectedJalali &&
                selectedJalali.jy === viewYear &&
                selectedJalali.jm === viewMonth &&
                selectedJalali.jd === day

              const isToday =
                todayJalali.jy === viewYear &&
                todayJalali.jm === viewMonth &&
                todayJalali.jd === day

              const isFriday = (idx % 7) === 6

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-action text-white font-bold shadow-md scale-105'
                      : isToday
                      ? 'border border-amber-400 text-amber-500 dark:text-amber-400 font-bold hover:bg-surface-2'
                      : isFriday
                      ? 'text-rose-500 dark:text-rose-400 hover:bg-surface-2'
                      : 'text-default hover:bg-surface-2'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              )
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="rounded-lg px-2.5 py-1 font-semibold text-action hover:bg-action/10 transition-colors"
            >
              امروز ({toPersianDigits(todayJalali.jd)} {PERSIAN_MONTHS[todayJalali.jm - 1]})
            </button>

            {displayText && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg px-2 py-1 text-muted hover:text-rose-400 transition-colors"
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
