'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile, XpAdjustment } from '@/utils/database.types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [adjustments, setAdjustments] = useState<XpAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      
      const [profRes, adjRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('xp_adjustments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      ])

      setProfile(profRes.data)
      if (adjRes.data) setAdjustments(adjRes.data as XpAdjustment[])
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
  if (!profile) return null

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-xl flex-1 p-4 py-8">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
          {/* User Profile Card */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white shadow-sm">
              {profile.full_name.charAt(0)}
            </div>
            <h1 className="text-xl font-bold text-default">{profile.full_name}</h1>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              profile.role === 'admin' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {profile.role === 'admin' ? 'مدیر سیستم' : 'عضو تیم'}
            </span>

            <div className="mt-6 rounded-xl bg-surface-2 p-5 border border-border/50">
              <p className="text-xs font-medium text-muted">مجموع امتیازات شما</p>
              <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
                <span className="text-4xl font-bold text-emerald-500">{profile.xp_total}</span>
                <span className="text-sm font-semibold text-amber-400">XP</span>
              </div>
            </div>
          </div>

          {/* XP History Section */}
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-sm font-bold text-default mb-4">تاریخچه امتیازات و فعالیت‌ها</h2>
            {adjustments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-surface-2/30 p-6 text-center text-xs text-muted">
                هنوز هیچ فعالیت امتیازی یا تشویقی برای شما ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-2.5">
                {adjustments.map((adj) => {
                  const isPositive = adj.amount > 0
                  const typeLabels: Record<string, { title: string; color: string }> = {
                    reward: { title: '🎁 تشویقی', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                    penalty: { title: '⚠️ پنالتی', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                    task_completion: { title: '✅ تکمیل تسک', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                    task_reversal: { title: '↩️ کسر تسک', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  }
                  const badge = typeLabels[adj.type] || { title: adj.type, color: 'bg-gray-500/10 text-gray-400' }

                  return (
                    <div
                      key={adj.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 p-3 text-xs transition-all hover:bg-surface-2/70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
                            {badge.title}
                          </span>
                          <span className="text-[10px] text-muted">
                            {new Date(adj.created_at).toLocaleDateString('fa-IR')}
                          </span>
                        </div>
                        <p className="text-default text-xs" title={adj.reason}>
                          {adj.reason}
                        </p>
                      </div>
                      <span
                        className={`font-bold shrink-0 text-sm ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${adj.amount}` : adj.amount} XP
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
