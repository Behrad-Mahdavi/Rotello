'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import ThemeToggle from '@/components/ThemeToggle'
import { getCachedProfile, setCachedProfile } from '@/utils/userCache'
import { createClient } from '@/utils/supabase/client'
import { toJalaali, PERSIAN_MONTHS, toPersianDigits } from '@/utils/jalaali'
import type { Profile } from '@/utils/database.types'
import { Calendar } from 'lucide-react'

interface AppHeaderProps {
  profile?: { full_name: string; xp_total: number; role: string } | null
}

export default function AppHeader({ profile: propProfile }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentProfile, setCurrentProfile] = useState<Profile | { full_name: string; xp_total: number; role: string } | null>(() => {
    return propProfile || getCachedProfile()
  })
  const [currentDateStr, setCurrentDateStr] = useState<string>('')

  useEffect(() => {
    const now = new Date()
    const j = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const weekdays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']
    const dayName = weekdays[now.getDay()]
    const monthName = PERSIAN_MONTHS[j.jm - 1]
    setCurrentDateStr(`${dayName} ${toPersianDigits(j.jd)} ${monthName}`)
  }, [])

  // Synchronize profile prop and cache
  useEffect(() => {
    if (propProfile) {
      setCurrentProfile(propProfile)
      setCachedProfile(propProfile as Profile)
    } else {
      const cached = getCachedProfile()
      if (cached) {
        setCurrentProfile(cached)
      } else {
        // Fallback: fetch session profile if missing
        const fetchProfile = async () => {
          const supabase = createClient()
          const { data } = await supabase.auth.getSession()
          const session = data?.session
          if (session?.user) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
            if (profData) {
              const p = {
                ...profData,
                role: session.user.user_metadata?.role || profData.role,
                departments: session.user.user_metadata?.departments || profData.departments || [],
                avatar_url: profData.avatar_url || session.user.user_metadata?.avatar_url || null,
              } as Profile
              setCurrentProfile(p)
              setCachedProfile(p)
            }
          }
        }
        fetchProfile()
      }
    }

    const handleProfileUpdate = () => {
      const cached = getCachedProfile()
      if (cached) setCurrentProfile(cached)
    }
    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('profile-updated', handleProfileUpdate)
  }, [propProfile])

  const isAdmin = currentProfile?.role === 'admin'

  const TABS = [
    ...(isAdmin ? [{ key: '/dashboard', label: 'داشبورد' }] : []),
    ...(isAdmin ? [{ key: '/admin/members', label: 'مدیریت اعضا' }] : []),
    { key: '/projects', label: 'پروژه‌ها' },
    { key: '/events', label: 'رویدادها' },
    { key: '/my-tasks', label: 'تسک‌های من' },
    { key: '/leaderboard', label: 'لیدربورد' },
  ]

  // Detect active tab properly
  const isTabActive = (tabKey: string) => {
    if (tabKey === '/projects') {
      return pathname === '/projects' || pathname.startsWith('/projects/')
    }
    if (tabKey === '/events') {
      return pathname === '/events' || pathname.startsWith('/events/')
    }
    if (tabKey === '/admin/members') {
      return pathname.startsWith('/admin/members')
    }
    return pathname === tabKey || pathname.startsWith(tabKey + '/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
        {/* Brand Logo & Title */}
        <div 
          onClick={() => router.push('/projects')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && router.push('/projects')}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-action rounded-xl p-1 -m-1 transition-transform active:scale-95"
        >
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-xs border border-border group-hover:scale-105 group-hover:border-action/50 transition-all shrink-0 bg-surface">
            <Image 
              src="/logo-main.jpg" 
              alt="روتلو باشگاه رکاد" 
              width={36} 
              height={36} 
              className="h-full w-full object-cover" 
            />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-default group-hover:text-action transition-colors">
                روتلو
              </h1>
              <span className="inline-flex items-center rounded-full badge-club px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black tracking-wide transition-all">
                باشگاه
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:block">
          <div className="flex gap-1 rounded-2xl bg-surface-2/80 p-1 border border-border/80 shadow-2xs">
            {TABS.map((t) => {
              const active = isTabActive(t.key)
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => router.push(t.key)}
                  className={`cursor-pointer select-none rounded-xl px-2.5 lg:px-3.5 py-1.5 text-xs lg:text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-action/60 ${
                    active
                      ? 'bg-action text-white shadow-xs scale-[1.02]'
                      : 'text-muted hover:text-action hover:bg-action/10 active:scale-95'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Jalali Date (Section 7.9 standard) */}
          {currentDateStr && (
            <div className="hidden xl:flex items-center gap-1.5 rounded-xl bg-surface-2/80 border border-border/70 px-3 py-1.5 text-xs text-subtle font-medium shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-action shrink-0" />
              <span>{currentDateStr}</span>
            </div>
          )}

          {currentProfile ? (
            <button 
              onClick={() => router.push('/profile')}
              type="button"
              className="cursor-pointer select-none flex items-center gap-1.5 sm:gap-2 rounded-xl bg-surface-2/80 border border-border/70 p-1 sm:p-1.5 pl-2 sm:pl-3 text-xs font-medium text-subtle transition-all hover:bg-surface hover:text-default hover:border-action/40 hover:shadow-xs active:scale-95"
              title="مشاهده پروفایل کاربری"
            >
              {/* Circular Avatar Photo */}
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-gradient-to-br from-[#59BBAF] to-[#202A5A] text-white text-[11px] font-black shadow-2xs">
                {'avatar_url' in currentProfile && currentProfile.avatar_url ? (
                  <img
                    src={currentProfile.avatar_url}
                    alt={currentProfile.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{currentProfile.full_name ? currentProfile.full_name.charAt(0) : 'ک'}</span>
                )}
              </div>

              <span className="hidden sm:inline font-bold">{currentProfile.full_name}</span>
              {currentProfile.role === 'member' && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xp font-extrabold tracking-tight">
                  {currentProfile.xp_total} XP
                </span>
              )}
            </button>
          ) : (
            <div className="h-8 w-20 rounded-xl bg-surface-2/60 animate-pulse hidden sm:block" />
          )}

          {/* Theme Switcher */}
          <ThemeToggle className="cursor-pointer select-none active:scale-95" />

          {/* Minimal Logout */}
          <LogoutButton minimal />
        </div>
      </div>

      {/* Mobile Navigation Tabs */}
      <nav className="border-t border-border px-3 py-2 md:hidden bg-surface-2/50">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((t) => {
            const active = isTabActive(t.key)
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => router.push(t.key)}
                className={`cursor-pointer select-none shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                  active
                    ? 'bg-action text-white shadow-xs'
                    : 'text-muted hover:text-action hover:bg-action/10'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
