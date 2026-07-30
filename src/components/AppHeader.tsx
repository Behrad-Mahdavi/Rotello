'use client'

import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

interface AppHeaderProps {
  profile?: { full_name: string; xp_total: number; role: string } | null
}

export default function AppHeader({ profile }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const TABS = [
    ...(isAdmin ? [{ key: '/dashboard', label: 'داشبورد' }] : []),
    ...(isAdmin ? [{ key: '/admin/members', label: 'مدیریت اعضا' }] : []),
    { key: '/projects', label: 'پروژه‌ها' },
    { key: '/leaderboard', label: 'لیدربورد' },
    ...(!isAdmin ? [{ key: '/my-tasks', label: 'تسک‌های من' }] : []),
  ]

  const activeTab = TABS.find((t) => pathname.startsWith(t.key))?.key || ''

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <Image src="/logog.png" alt="رکاد" width={22} height={22} className="object-contain brightness-0 invert" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-tight text-default sm:text-base">رکاد</h1>
            <p className="hidden text-[11px] text-muted sm:block">مدیریت پروژه و کارها</p>
          </div>
        </div>

        <nav className="hidden md:block">
          <div className="flex gap-1 rounded-lg bg-surface-2/60 p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => router.push(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:text-sm ${
                  activeTab === t.key || pathname === t.key
                    ? 'bg-white/[0.09] text-default'
                    : 'text-muted hover:text-default hover:bg-white/[0.04]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          {profile && (
            <button onClick={() => router.push('/profile')}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-subtle transition-colors hover:bg-surface hover:text-default sm:px-3">
              <span className="hidden sm:inline">{profile.full_name}</span>
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xp">{profile.xp_total} XP</span>
            </button>
          )}
          <LogoutButton minimal />
        </div>
      </div>

      <nav className="border-t border-border px-4 py-2 md:hidden">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((t) => {
            const active = activeTab === t.key || pathname === t.key
            return (
              <button
                key={t.key}
                onClick={() => router.push(t.key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-action text-white'
                    : 'text-muted hover:bg-surface-2 hover:text-default'
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
