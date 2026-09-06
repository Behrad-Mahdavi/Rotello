'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile, XpAdjustment } from '@/utils/database.types'

interface CompletedTaskItem {
  id: string
  title: string
  status: string
  xp_value: number
  priority: string
  deadline: string | null
  updated_at: string
  created_at: string
  projects?: { name: string } | null
}

function ProfileContent() {
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null)
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskItem[]>([])
  const [adjustments, setAdjustments] = useState<XpAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'xp'>('tasks')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'reward' | 'penalty' | 'task'>('all')

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const targetUserId = searchParams.get('id')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const effectiveUserId = targetUserId || user.id

      const [currentProfRes, targetProfRes, assigneesRes, adjRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('profiles').select('*').eq('id', effectiveUserId).single(),
        supabase
          .from('task_assignees')
          .select('task_id, tasks(id, title, status, xp_value, priority, deadline, updated_at, created_at, project_id, projects(name))')
          .eq('user_id', effectiveUserId),
        supabase
          .from('xp_adjustments')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (currentProfRes.data) setCurrentUserProfile(currentProfRes.data)
      if (targetProfRes.data) setTargetProfile(targetProfRes.data)

      if (assigneesRes.data) {
        const tasks: CompletedTaskItem[] = []
        for (const item of assigneesRes.data) {
          const rawTask = item.tasks as unknown as CompletedTaskItem | null
          if (rawTask && rawTask.status === 'done') {
            tasks.push(rawTask)
          }
        }
        tasks.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
        setCompletedTasks(tasks)
      }

      if (adjRes.data) setAdjustments(adjRes.data as XpAdjustment[])
      setLoading(false)
    }
    load()
  }, [targetUserId, router, supabase])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">در حال بارگذاری...</div>
      </div>
    )
  }

  if (!targetProfile) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader profile={currentUserProfile} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">کاربر مورد نظر یافت نشد.</div>
      </div>
    )
  }

  const isOwnProfile = !targetUserId || targetUserId === currentUserProfile?.id
  const rewardsCount = adjustments.filter((a) => a.type === 'reward').length
  const penaltiesCount = adjustments.filter((a) => a.type === 'penalty').length
  const totalTasksXp = completedTasks.reduce((sum, t) => sum + (t.xp_value || 0), 0)

  const filteredAdjustments = adjustments.filter((adj) => {
    if (historyFilter === 'all') return true
    if (historyFilter === 'reward') return adj.type === 'reward'
    if (historyFilter === 'penalty') return adj.type === 'penalty'
    if (historyFilter === 'task') return adj.type === 'task_completion' || adj.type === 'task_reversal'
    return true
  })

  const priorityLabels: Record<string, { label: string; color: string }> = {
    urgent: { label: 'فوری', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    important: { label: 'مهم', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    normal: { label: 'عادی', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={currentUserProfile} />

      <main className="mx-auto w-full max-w-2xl flex-1 p-4 py-6 sm:py-8 space-y-6">
        {/* User Card */}
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
          <div className="text-center">
            <div
              className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-md bg-gradient-to-br ${
                targetProfile.role === 'admin'
                  ? 'from-violet-500 to-purple-700'
                  : 'from-emerald-500 to-teal-600'
              }`}
            >
              {targetProfile.full_name.charAt(0)}
            </div>
            <h1 className="text-xl font-bold text-default">{targetProfile.full_name}</h1>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                targetProfile.role === 'admin'
                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {targetProfile.role === 'admin' ? 'مدیر سیستم' : 'عضو تیم'}
            </span>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                <p className="text-[11px] font-medium text-muted">
                  {isOwnProfile ? 'امتیاز کل شما' : 'امتیاز کل'}
                </p>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-black text-amber-400">{targetProfile.xp_total}</span>
                  <span className="text-xs font-bold text-amber-500">XP</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                <p className="text-[11px] font-medium text-muted">تسک‌های انجام‌شده</p>
                <span className="mt-1 block text-2xl font-black text-emerald-400">{completedTasks.length}</span>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                <p className="text-[11px] font-medium text-muted">تشویقی‌ها</p>
                <span className="mt-1 block text-2xl font-black text-teal-400">{rewardsCount}</span>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 p-4 text-center">
                <p className="text-[11px] font-medium text-muted">پنالتی‌ها</p>
                <span className="mt-1 block text-2xl font-black text-rose-400">{penaltiesCount}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-8 flex items-center gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
                activeTab === 'tasks'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-muted hover:text-default'
              }`}
            >
              <span>✅ تسک‌های انجام‌شده</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium">
                {completedTasks.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('xp')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
                activeTab === 'xp'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-muted hover:text-default'
              }`}
            >
              <span>⚡ ریز امتیازات و سوابق (XP)</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium">
                {adjustments.length}
              </span>
            </button>
          </div>

          {/* Tab 1: Completed Tasks */}
          {activeTab === 'tasks' && (
            <div className="mt-5 space-y-2.5">
              {completedTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-surface-2/30 p-8 text-center text-xs text-muted">
                  تاکنون هیچ تسک تکمیل‌شده‌ای ثبت نشده است.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted px-1 mb-1">
                    <span>کارهای به پایان رسیده:</span>
                    <span>مجموع امتیاز تسک‌ها: <strong className="text-amber-400">{totalTasksXp} XP</strong></span>
                  </div>
                  {completedTasks.map((t) => {
                    const priority = priorityLabels[t.priority] || priorityLabels.normal
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 p-3.5 transition-all hover:bg-surface-2/70"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-default truncate">
                              {t.title}
                            </span>
                            {t.projects?.name && (
                              <span className="rounded-md bg-surface border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted shrink-0">
                                {t.projects.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted">
                            <span className={`rounded-full border px-1.5 py-0.2 text-[10px] font-medium ${priority.color}`}>
                              {priority.label}
                            </span>
                            <span>
                              تاریخ انجام: {new Date(t.updated_at || t.created_at).toLocaleDateString('fa-IR')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
                            +{t.xp_value} XP
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* Tab 2: XP Adjustments History */}
          {activeTab === 'xp' && (
            <div className="mt-5 space-y-3">
              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    historyFilter === 'all'
                      ? 'border-border-subtle bg-surface text-default'
                      : 'border-transparent text-muted hover:text-default'
                  }`}
                >
                  همه ({adjustments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('reward')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    historyFilter === 'reward'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-transparent text-muted hover:text-emerald-400'
                  }`}
                >
                  🎁 تشویقی‌ها ({rewardsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('penalty')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    historyFilter === 'penalty'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                      : 'border-transparent text-muted hover:text-rose-400'
                  }`}
                >
                  ⚠️ پنالتی‌ها ({penaltiesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('task')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    historyFilter === 'task'
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      : 'border-transparent text-muted hover:text-blue-400'
                  }`}
                >
                  ✅ تسک‌ها
                </button>
              </div>

              {filteredAdjustments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-surface-2/30 p-8 text-center text-xs text-muted">
                  هنوز هیچ فعالیت یا سابقه امتیازی برای این فیلتر ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAdjustments.map((adj) => {
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
          )}
        </div>
      </main>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
          <AppHeader />
          <div className="flex flex-1 items-center justify-center text-sm text-muted">در حال بارگذاری...</div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  )
}
