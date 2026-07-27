'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile } from '@/utils/database.types'

const MEDAL_STYLES: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  1: { bg: 'bg-gradient-to-br from-amber-400 to-yellow-600', border: 'border-amber-400/50', text: 'text-amber-300', glow: 'shadow-amber-500/20' },
  2: { bg: 'bg-gradient-to-br from-gray-300 to-gray-500', border: 'border-gray-400/50', text: 'text-gray-300', glow: 'shadow-gray-400/20' },
  3: { bg: 'bg-gradient-to-br from-orange-400 to-amber-700', border: 'border-orange-400/50', text: 'text-orange-300', glow: 'shadow-orange-500/20' },
}

const MEDAL_LABELS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      const { data } = await supabase.from('profiles').select('*').order('xp_total', { ascending: false })
      if (data) setMembers(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )

  const top3 = members.slice(0, 3)
  const rest = members.slice(3)

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-default">لیدربورد</h2>
          <p className="text-sm text-muted">رتبه‌بندی اعضا بر اساس XP</p>
        </div>

        {top3.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {top3.map((m, i) => {
              const rank = i + 1
              const medal = MEDAL_STYLES[rank]
              return (
                <div key={m.id} className={`relative rounded-2xl border ${medal.border} bg-surface p-6 text-center shadow-lg ${medal.glow} transition-all hover:shadow-xl`}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">{MEDAL_LABELS[rank]}</div>
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${medal.bg} text-xl font-bold text-white shadow-lg`}>
                    {m.full_name.charAt(0)}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-default">{m.full_name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
                    m.role === 'admin' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {m.role === 'admin' ? 'مدیر' : 'عضو'}
                  </span>
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-lg font-bold text-amber-400">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {m.xp_total} XP
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {rest.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="divide-y divide-border">
              {rest.map((m, i) => {
                const rank = i + 4
                return (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/50 sm:px-6 sm:py-4">
                    <span className="w-8 text-center text-sm font-bold text-muted">#{rank}</span>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                      m.role === 'admin' ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    }`}>
                      {m.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-sm font-semibold text-default">{m.full_name}</h4>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        m.role === 'admin' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {m.role === 'admin' ? 'مدیر' : 'عضو'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-amber-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {m.xp_total}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {members.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-sm text-muted">
            هنوز هیچ عضوی وجود ندارد.
          </div>
        )}
      </main>
    </div>
  )
}
