'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Profile, XpAdjustment } from '@/utils/database.types'
import MemberXpModal from './MemberXpModal'

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

interface MemberProfileModalProps {
  userId: string | null
  isOpen: boolean
  onClose: () => void
  currentProfile?: Profile | null
  onXpChanged?: (userId: string, newXp: number) => void
}

export default function MemberProfileModal({
  userId,
  isOpen,
  onClose,
  currentProfile,
  onXpChanged,
}: MemberProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskItem[]>([])
  const [adjustments, setAdjustments] = useState<XpAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'xp'>('tasks')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'reward' | 'penalty' | 'task'>('all')

  // Sub-modal for admin reward / penalty
  const [xpModalOpen, setXpModalOpen] = useState(false)
  const [xpModalTab, setXpModalTab] = useState<'reward' | 'penalty'>('reward')

  const supabase = createClient()

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null)
      setCompletedTasks([])
      setAdjustments([])
      return
    }

    async function loadMemberData() {
      setLoading(true)
      try {
        const [profRes, assigneesRes, adjRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase
            .from('task_assignees')
            .select('task_id, tasks(id, title, status, xp_value, priority, deadline, updated_at, created_at, project_id, projects(name))')
            .eq('user_id', userId),
          supabase
            .from('xp_adjustments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
        ])

        if (profRes.data) {
          setProfile(profRes.data as Profile)
        }

        if (assigneesRes.data) {
          const tasks: CompletedTaskItem[] = []
          for (const item of assigneesRes.data) {
            const rawTask = item.tasks as unknown as CompletedTaskItem | null
            if (rawTask && rawTask.status === 'done') {
              tasks.push(rawTask)
            }
          }
          // Sort by completion date descending
          tasks.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
          setCompletedTasks(tasks)
        }

        if (adjRes.data) {
          setAdjustments(adjRes.data as XpAdjustment[])
        }
      } catch (err) {
        console.error('Error fetching member profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMemberData()
  }, [isOpen, userId])

  if (!isOpen || !userId) return null

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

  function handleOpenXp(tab: 'reward' | 'penalty') {
    setXpModalTab(tab)
    setXpModalOpen(true)
  }

  function handleXpUpdatedLocally(id: string, newXp: number) {
    if (profile && profile.id === id) {
      setProfile({ ...profile, xp_total: newXp })
    }
    onXpChanged?.(id, newXp)
    // Refetch adjustments
    supabase
      .from('xp_adjustments')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then((res: { data: unknown }) => {
        if (res.data) setAdjustments(res.data as XpAdjustment[])
      })

  }

  const priorityLabels: Record<string, { label: string; color: string }> = {
    urgent: { label: 'فوری', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    important: { label: 'مهم', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    normal: { label: 'عادی', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
        onClick={onClose}
        dir="rtl"
      >
        <div
          className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <h3 className="text-base font-bold text-default">پروفایل و کارنامه عضو</h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-sm text-muted">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-3" />
                <span>در حال بارگذاری اطلاعات عضو...</span>
              </div>
            ) : !profile ? (
              <div className="py-12 text-center text-sm text-muted">عضو مورد نظر یافت نشد.</div>
            ) : (
              <>
                {/* Profile Overview Card */}
                <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface-2/60 to-surface-2/20 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md bg-gradient-to-br ${
                          profile.role === 'admin'
                            ? 'from-violet-500 to-purple-700'
                            : 'from-emerald-500 to-teal-600'
                        }`}
                      >
                        {profile.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-default">{profile.full_name}</h2>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              profile.role === 'admin'
                                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {profile.role === 'admin' ? 'مدیر سیستم' : 'عضو تیم'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          عضویت از: {new Date(profile.created_at).toLocaleDateString('fa-IR')}
                        </p>
                      </div>
                    </div>

                    {/* Admin Action Buttons (Reward / Penalty) */}
                    {currentProfile?.role === 'admin' && (
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenXp('reward')}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95 shadow-sm"
                        >
                          <span>🎁</span>
                          <span>اعطای تشویقی</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenXp('penalty')}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95 shadow-sm"
                        >
                          <span>⚠️</span>
                          <span>ثبت پنالتی</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                      <span className="block text-[11px] font-medium text-muted mb-1">مجموع امتیاز</span>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-xl font-black text-amber-400">{profile.xp_total}</span>
                        <span className="text-[10px] font-bold text-amber-500/80">XP</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                      <span className="block text-[11px] font-medium text-muted mb-1">تسک‌های انجام‌شده</span>
                      <span className="text-xl font-black text-emerald-400">{completedTasks.length}</span>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                      <span className="block text-[11px] font-medium text-muted mb-1">تشویقی‌های دریافتی</span>
                      <span className="text-xl font-black text-teal-400">{rewardsCount}</span>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                      <span className="block text-[11px] font-medium text-muted mb-1">پنالتی‌های ثبت‌شده</span>
                      <span className="text-xl font-black text-rose-400">{penaltiesCount}</span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-border">
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
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium">
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
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium">
                      {adjustments.length}
                    </span>
                  </button>
                </div>

                {/* Tab 1: Completed Tasks */}
                {activeTab === 'tasks' && (
                  <div className="space-y-2.5">
                    {completedTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/80 bg-surface-2/20 p-8 text-center text-xs text-muted">
                        تاکنون هیچ تسکی با وضعیت «تکمیل‌شده» برای این عضو ثبت نشده است.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-muted px-1">
                          <span>لیست کارهای خاتمه‌یافته توسط {profile.full_name}:</span>
                          <span>مجموع امتیاز تسک‌ها: <strong className="text-amber-400">{totalTasksXp} XP</strong></span>
                        </div>
                        {completedTasks.map((t) => {
                          const priority = priorityLabels[t.priority] || priorityLabels.normal
                          return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/30 p-3.5 transition-all hover:bg-surface-2/60"
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

                {/* Tab 2: XP Adjustments & History */}
                {activeTab === 'xp' && (
                  <div className="space-y-3">
                    {/* Filters */}
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
                        همه سوابق ({adjustments.length})
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
                        ✅ امتیازات تسک
                      </button>
                    </div>

                    {filteredAdjustments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/80 bg-surface-2/20 p-8 text-center text-xs text-muted">
                        هیچ سابقه‌ای با این فیلتر یافت نشد.
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/30 p-3 text-xs transition-all hover:bg-surface-2/60"
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal: MemberXpModal for Admins */}
      {profile && (
        <MemberXpModal
          isOpen={xpModalOpen}
          member={profile}
          initialType={xpModalTab}
          onClose={() => setXpModalOpen(false)}
          onSuccess={handleXpUpdatedLocally}
        />
      )}
    </>
  )
}
