'use client'

import React, { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Profile, XpAdjustment } from '@/utils/database.types'
import { getRoleInfo, DEPARTMENTS } from '@/constants/departments'
import MemberXpModal from './MemberXpModal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { X, Gift, AlertTriangle, CheckCircle2, Zap, RotateCcw, Camera, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { setCachedProfile, getCachedProfile } from '@/utils/userCache'
import { formatToPersianDate } from '@/utils/jalaali'

interface ErrorBoundaryProps {
  onClose: () => void
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class MemberProfileErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MemberProfileModal caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center" dir="rtl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-default mb-1">خطا در بارگذاری کارنامه</h3>
          <p className="text-xs text-muted mb-4 max-w-sm">
            متأسفانه هنگام پردازش سوابق این عضو خطایی رخ داد.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-xl bg-action px-4 py-2 text-xs font-bold text-white hover:bg-action-hover transition-colors cursor-pointer"
            >
              تلاش مجدد
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs font-medium text-default hover:bg-surface transition-colors cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

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
  initialMember?: Profile | null
  isAdmin?: boolean
  onXpChanged?: (userId: string, newXp: number) => void
}

export default function MemberProfileModal({
  userId,
  isOpen,
  onClose,
  currentProfile,
  initialMember,
  isAdmin,
  onXpChanged,
}: MemberProfileModalProps) {
  useBodyScrollLock(isOpen)
  const [profile, setProfile] = useState<Profile | null>(initialMember || null)
  const [sessionAdmin, setSessionAdmin] = useState(false)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskItem[]>([])
  const [adjustments, setAdjustments] = useState<XpAdjustment[]>([])
  const [loading, setLoading] = useState(!initialMember)
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

    if (initialMember && initialMember.id === userId) {
      setProfile(initialMember)
      setLoading(false)
    } else {
      setLoading(true)
    }

    async function loadMemberData() {
      try {
        const [memberRes, assigneesRes, adjRes] = await Promise.all([
          fetch(`/api/members?id=${userId}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
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

        if (memberRes?.member) {
          setProfile(memberRes.member as Profile)
        } else {
          // Fallback to direct supabase query
          const { data: fallbackProf } = await supabase.from('profiles').select('*').eq('id', userId).single()
          if (fallbackProf) setProfile(fallbackProf as Profile)
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
          tasks.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
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

  useEffect(() => {
    const cached = getCachedProfile()
    if (cached) {
      if (cached.role === 'admin') setSessionAdmin(true)
      if (cached.id) setSessionUserId(cached.id)
    }
    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession()
        const u = data?.session?.user
        if (u) {
          setSessionUserId(u.id)
          if (u.user_metadata?.role === 'admin') setSessionAdmin(true)
        }
      } catch {
        // silent fallback
      }
    }
    checkSession()
  }, [])

  const isUserAdmin = Boolean(
    isAdmin ||
    sessionAdmin ||
    currentProfile?.role === 'admin'
  )

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const canEditAvatar = Boolean(
    profile && (
      isUserAdmin ||
      currentProfile?.id === profile.id ||
      sessionUserId === profile.id
    )
  )

  async function handleAvatarUpload(file: File) {
    if (!profile) return
    if (!file.type.startsWith('image/')) {
      alert('لطفاً یک فایل تصویری انتخاب کنید.')
      return
    }

    setUploadingAvatar(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new window.Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const size = Math.min(img.width, img.height)
            const targetSize = 256
            canvas.width = targetSize
            canvas.height = targetSize
            const ctx = canvas.getContext('2d')
            if (!ctx) return reject(new Error('Canvas context unavailable'))
            const startX = (img.width - size) / 2
            const startY = (img.height - size) / 2
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize)
            resolve(canvas.toDataURL('image/jpeg', 0.88))
          }
          img.onerror = () => reject(new Error('خطا در پردازش تصویر'))
          img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error('خطا در خواندن فایل'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          avatarUrl: dataUrl,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'خطا در ثبت عکس پروفایل')
      }

      const updated = {
        ...profile,
        avatar_url: json.avatar_url,
      }
      setProfile(updated)

      if (currentProfile?.id === profile.id) {
        setCachedProfile(updated)
        window.dispatchEvent(new Event('profile-updated'))
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'خطا در آپلود عکس')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!profile || !profile.avatar_url) return
    if (!confirm('آیا از حذف عکس پروفایل اطمینان دارید؟')) return

    setUploadingAvatar(true)
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          avatarUrl: null,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'خطا در حذف عکس')
      }

      const updated = {
        ...profile,
        avatar_url: null,
      }
      setProfile(updated)

      if (currentProfile?.id === profile.id) {
        setCachedProfile(updated)
        window.dispatchEvent(new Event('profile-updated'))
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'خطا در حذف عکس')
    } finally {
      setUploadingAvatar(false)
    }
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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-6">
            <MemberProfileErrorBoundary onClose={onClose}>
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
                        {/* Avatar with image display and upload */}
                        <div className="relative h-16 w-16 shrink-0">
                          <div
                            className={`relative flex h-full w-full items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md bg-gradient-to-br overflow-hidden border border-border/80 ${
                              getRoleInfo(profile.role).badgeGradient
                            }`}
                          >
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (profile.full_name || '؟').charAt(0)
                            )}

                            {uploadingAvatar && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                                <Loader2 className="h-5 w-5 text-white animate-spin" />
                              </div>
                            )}
                          </div>

                          {canEditAvatar && (
                            <div className="absolute -bottom-1 -left-1 flex items-center gap-1 z-10">
                              <label
                                htmlFor="modal-avatar-file-input"
                                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-action text-white shadow-md transition-all hover:bg-action-hover active:scale-95 border border-surface"
                                title="تغییر عکس پروفایل"
                              >
                                <Camera className="h-3 w-3" />
                                <input
                                  id="modal-avatar-file-input"
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleAvatarUpload(file)
                                    e.target.value = ''
                                  }}
                                  disabled={uploadingAvatar}
                                />
                              </label>

                              {profile.avatar_url && (
                                <button
                                  type="button"
                                  onClick={handleRemoveAvatar}
                                  disabled={uploadingAvatar}
                                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-rose-500/90 text-white shadow-md transition-all hover:bg-rose-600 active:scale-95 border border-surface"
                                  title="حذف عکس پروفایل"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-default">{profile.full_name || 'کاربر'}</h2>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                getRoleInfo(profile.role).colorClass
                              }`}
                            >
                              {getRoleInfo(profile.role).label}
                            </span>
                          </div>

                          {/* Departments and Levels */}
                          {profile.role !== 'admin' && Array.isArray(profile.departments) && profile.departments.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {profile.departments.map((d) => {
                                const depConfig = DEPARTMENTS[d.department]
                                if (!depConfig) return null
                                if (profile.role === 'mentor') {
                                  return (
                                    <span
                                      key={d.department}
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${depConfig.badgeClass}`}
                                    >
                                      <span>منتور {depConfig.label}</span>
                                    </span>
                                  )
                                }
                                return (
                                  <span
                                    key={d.department}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${depConfig.badgeClass}`}
                                  >
                                    <span>{depConfig.label}</span>
                                    <span className="rounded bg-surface px-1 py-0.2 text-[9px]">سطح {d.level}</span>
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          <p className="mt-1 text-xs text-muted">
                            عضویت از: {profile.created_at ? formatToPersianDate(profile.created_at) : '---'}
                          </p>
                        </div>
                      </div>

                      {/* Admin Action Buttons (Reward / Penalty) - ONLY for members */}
                      {currentProfile?.role === 'admin' && profile.role === 'member' && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenXp('reward')}
                            className="cursor-pointer select-none flex items-center gap-1.5 rounded-xl border border-action/30 bg-action/10 px-3.5 py-2 text-xs font-bold text-action transition-all hover:bg-action/20 active:scale-95 shadow-xs"
                          >
                            <Gift className="w-3.5 h-3.5 text-action" />
                            <span>اعطای تشویقی</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenXp('penalty')}
                            className="cursor-pointer select-none flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/20 active:scale-95 shadow-xs"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                            <span>ثبت جریمه</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stats Grid */}
                    {profile.role === 'member' ? (
                      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">مجموع امتیاز</p>
                          <p className="text-base sm:text-lg font-black text-warning mt-0.5">{(profile.xp_total ?? 0).toLocaleString('fa-IR')} XP</p>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">تسک‌های انجام‌شده</p>
                          <p className="text-base sm:text-lg font-black text-default mt-0.5">{completedTasks.length.toLocaleString('fa-IR')}</p>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">تشویقی‌های دریافتی</p>
                          <p className="text-base sm:text-lg font-black text-action mt-0.5">{rewardsCount.toLocaleString('fa-IR')}</p>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">جریمه‌های ثبت‌شده</p>
                          <p className="text-base sm:text-lg font-black text-danger mt-0.5">{penaltiesCount.toLocaleString('fa-IR')}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">نقش کاربری</p>
                          <p className="text-base sm:text-lg font-black text-action mt-0.5">
                            {profile.role === 'admin' ? 'راهبر سیستم' : 'منتور باشگاه'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-surface/80 p-3 text-center">
                          <p className="text-[11px] font-medium text-muted">تسک‌های انجام‌شده</p>
                          <p className="text-base sm:text-lg font-black text-default mt-0.5">{completedTasks.length.toLocaleString('fa-IR')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-border/80">
                    <button
                      type="button"
                      onClick={() => setActiveTab('tasks')}
                      className={`cursor-pointer select-none flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
                        activeTab === 'tasks'
                          ? 'border-action text-action'
                          : 'border-transparent text-muted hover:text-default'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تسک‌های انجام‌شده</span>
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium">
                        {completedTasks.length.toLocaleString('fa-IR')}
                      </span>
                    </button>
                    {profile.role === 'member' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('xp')}
                        className={`cursor-pointer select-none flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
                          activeTab === 'xp'
                            ? 'border-amber-500 text-amber-500'
                            : 'border-transparent text-muted hover:text-default'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>ریز امتیازات و سوابق (XP)</span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-medium">
                          {adjustments.length.toLocaleString('fa-IR')}
                        </span>
                      </button>
                    )}
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
                            {profile.role === 'member' && (
                              <span>مجموع امتیاز تسک‌ها: <strong className="text-amber-400">{totalTasksXp.toLocaleString('fa-IR')} XP</strong></span>
                            )}
                          </div>
                          {completedTasks.map((t) => {
                            const priority = priorityLabels[t.priority] || priorityLabels.normal
                            const projName = Array.isArray(t.projects)
                              ? (t.projects as unknown as { name?: string }[])[0]?.name
                              : typeof t.projects === 'object' && t.projects
                              ? (t.projects as { name?: string }).name
                              : null

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
                                    {projName && (
                                      <span className="rounded-md bg-surface border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted shrink-0">
                                        {projName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted">
                                    <span className={`rounded-full border px-1.5 py-0.2 text-[10px] font-medium ${priority.color}`}>
                                      {priority.label}
                                    </span>
                                    <span>
                                      تاریخ انجام: {(t.updated_at || t.created_at) ? formatToPersianDate(t.updated_at || t.created_at) : '---'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
                                    +{(t.xp_value || 0).toLocaleString('fa-IR')} XP
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
                          همه سوابق ({adjustments.length.toLocaleString('fa-IR')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('reward')}
                          className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                            historyFilter === 'reward'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-transparent text-muted hover:text-emerald-400'
                          }`}
                        >
                          <Gift className="w-3 h-3" />
                          <span>تشویقی‌ها ({rewardsCount.toLocaleString('fa-IR')})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('penalty')}
                          className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                            historyFilter === 'penalty'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                              : 'border-transparent text-muted hover:text-rose-400'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>جریمه‌ها ({penaltiesCount.toLocaleString('fa-IR')})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter('task')}
                          className={`cursor-pointer inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                            historyFilter === 'task'
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                              : 'border-transparent text-muted hover:text-blue-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>امتیازات تسک</span>
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
                            const typeLabels: Record<string, { title: string; color: string; icon: React.ReactNode }> = {
                              reward: { title: 'تشویقی', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <Gift className="w-3 h-3" /> },
                              penalty: { title: 'جریمه', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: <AlertTriangle className="w-3 h-3" /> },
                              task_completion: { title: 'تکمیل تسک', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
                              task_reversal: { title: 'کسر تسک', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <RotateCcw className="w-3 h-3" /> },
                            }
                            const badge = (adj.type && typeLabels[adj.type]) || {
                              title: adj.type || 'تغییر امتیاز',
                              color: 'bg-surface-2 text-muted border-border',
                              icon: <Zap className="w-3 h-3" />,
                            }

                            return (
                              <div
                                key={adj.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/30 p-3 text-xs transition-all hover:bg-surface-2/60"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.color}`}>
                                      {badge.icon}
                                      <span>{badge.title}</span>
                                    </span>
                                    <span className="text-[10px] text-muted">
                                      {adj.created_at ? formatToPersianDate(adj.created_at) : '---'}
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
                                  {isPositive ? `+${(adj.amount || 0).toLocaleString('fa-IR')}` : (adj.amount || 0).toLocaleString('fa-IR')} XP
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
            </MemberProfileErrorBoundary>
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
