'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RequestXpModal from '@/components/RequestXpModal'
import { formatToPersianDate, toPersianDigits } from '@/utils/jalaali'
import { setCachedProfile } from '@/utils/userCache'
import type { Profile, Task, EventChecklistItem, XpRequest } from '@/utils/database.types'
import { Calendar, ClipboardList, CheckCircle2, Sparkles, Clock, Trash2, FolderKanban } from 'lucide-react'

interface TaskWithProject extends Task {
  project_name: string
}

interface EventItemWithEvent extends EventChecklistItem {
  event?: {
    id: string
    title: string
    event_date: string | null
    status: string
  } | null
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'بک‌لاگ',
  todo: 'در صف انجام',
  in_progress: 'در حال انجام',
  review: 'در حال بازبینی',
  done: 'تکمیل‌شده',
}

const STATUS_STYLE: Record<string, string> = {
  backlog: 'bg-gray-500/10 text-gray-400',
  todo: 'bg-slate-500/10 text-slate-400',
  in_progress: 'bg-emerald-500/10 text-emerald-400',
  review: 'bg-amber-500/10 text-amber-400',
  done: 'bg-teal-500/10 text-teal-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
}

const PRIORITY_STYLE: Record<string, string> = {
  normal: 'bg-sky-500/10 text-sky-400',
  important: 'bg-orange-500/10 text-orange-400',
  urgent: 'bg-rose-500/10 text-rose-400',
}

export default function MyTasksPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [eventItems, setEventItems] = useState<EventItemWithEvent[]>([])
  const [myRequests, setMyRequests] = useState<XpRequest[]>([])
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'events' | 'requests'>('all')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        router.push('/login')
        return
      }

      const [profRes, assignRes, eventRes, xpReqRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('task_assignees').select('task_id, task:tasks(*, project:projects(name))').eq('user_id', user.id),
        supabase.from('event_checklist_items').select(`
          *,
          event:events!event_checklist_items_event_id_fkey(id, title, event_date, status)
        `).eq('assignee_id', user.id).order('created_at', { ascending: false }),
        fetch('/api/xp-requests').then((r) => (r.ok ? r.json() : { requests: [] })).catch(() => ({ requests: [] })),
      ])

      if (profRes.data) setProfile(profRes.data)

      if (assignRes.data) {
        const enriched: TaskWithProject[] = []
        for (const a of assignRes.data as unknown as { task_id: string; task: (Task & { project: { name: string } | null }) | null }[]) {
          if (a.task) {
            enriched.push({
              ...a.task,
              project_name: a.task.project?.name || 'پروژه ناشناخته',
            })
          }
        }
        setTasks(enriched)
      }

      if (eventRes.data) {
        setEventItems(eventRes.data as EventItemWithEvent[])
      }

      if (xpReqRes?.requests) {
        setMyRequests(xpReqRes.requests)
      }

      setLoading(false)
    }
    load()

    const handleReqCreated = () => void loadMyRequests()
    window.addEventListener('xp-request-created', handleReqCreated)
    window.addEventListener('xp-requests-updated', handleReqCreated)
    window.addEventListener('member-xp-updated', handleReqCreated)
    return () => {
      window.removeEventListener('xp-request-created', handleReqCreated)
      window.removeEventListener('xp-requests-updated', handleReqCreated)
      window.removeEventListener('member-xp-updated', handleReqCreated)
    }
  }, [])

  async function loadMyRequests() {
    try {
      const res = await fetch('/api/xp-requests')
      if (res.ok) {
        const data = await res.json()
        if (data.requests) setMyRequests(data.requests)
      }
      // Refresh user profile so updated XP is immediately reflected
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: pData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (pData) {
          setProfile(pData)
          setCachedProfile(pData)
          window.dispatchEvent(new CustomEvent('profile-updated'))
        }
      }
    } catch {
      // silent
    }
  }

  async function handleCancelRequest(id: string) {
    if (!confirm('آیا از لغو این درخواست امتیاز اطمینان دارید؟')) return
    try {
      const res = await fetch(`/api/xp-requests/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMyRequests((prev) => prev.filter((r) => r.id !== id))
      }
    } catch {
      // silent
    }
  }

  async function handleToggleEventItem(item: EventItemWithEvent) {
    if (!profile) return
    const newDone = !item.is_done
    const updatePayload = {
      is_done: newDone,
      done_by: newDone ? profile.id : null,
      done_at: newDone ? new Date().toISOString() : null,
    }

    setEventItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, ...updatePayload } : it))
    )

    await supabase
      .from('event_checklist_items')
      .update(updatePayload)
      .eq('id', item.id)
  }

  const totalCount = tasks.length + eventItems.length

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 space-y-4 animate-pulse">
          <div className="h-10 w-56 rounded-2xl bg-surface-2/70" />
          <div className="h-12 w-full rounded-2xl bg-surface-2/70" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-surface-2/70 border border-border/80" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {/* Header Title & Summary */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-default">تسک‌ها و مسئولیت‌های من</h2>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
                {totalCount} مورد
              </span>
            </div>

            {/* Request XP Action Button */}
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="rokad-btn-primary px-3.5 py-1.5 text-xs font-bold shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ثبت درخواست XP</span>
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-2/80 p-1 self-start sm:self-auto overflow-x-auto max-w-full scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setActiveTab('all')}
              className={`shrink-0 rounded-lg min-h-[36px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center justify-center transition active:scale-95 ${
                activeTab === 'all' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              همه ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`shrink-0 rounded-lg min-h-[36px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center justify-center transition active:scale-95 ${
                activeTab === 'projects' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              تسک‌های پروژه ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`shrink-0 rounded-lg min-h-[36px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center justify-center transition active:scale-95 ${
                activeTab === 'events' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              مسئولیت‌های رویداد ({eventItems.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`shrink-0 rounded-lg min-h-[36px] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center justify-center transition active:scale-95 ${
                activeTab === 'requests' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 ml-1 text-amber-500" />
              <span>درخواست‌های امتیاز ({myRequests.length})</span>
            </button>
          </div>
        </div>

        {activeTab === 'requests' ? (
          /* Tab: My XP Requests */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-default">وضعیت درخواست‌های امتیاز من</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(true)}
                className="rokad-btn-primary px-3 py-1.5 text-xs font-bold"
              >
                + درخواست جدید
              </button>
            </div>

            {myRequests.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-12 text-center space-y-3">
                <Sparkles className="w-10 h-10 text-amber-500/50 mx-auto" />
                <div className="text-sm font-bold text-default">هنوز هیچ درخواست امتیازی ثبت نکرده‌اید</div>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  اگر تسک یا فعالیتی انجام داده‌اید که امتیازش برایتان محاسبه نشده، می‌توانید از دکمه بالا درخواست خود را برای راهبر ارسال کنید.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="rokad-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ثبت اولین درخواست XP</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`rounded-2xl border-[1.5px] p-4 sm:p-5 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] transition-all bg-surface ${
                      req.status === 'pending'
                        ? 'border-amber-500/40'
                        : req.status === 'approved'
                        ? 'border-emerald-500/40'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-default">{req.title}</span>
                        {req.project?.name && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-action border border-border/80">
                            <FolderKanban className="w-3 h-3 text-action" />
                            <span>{req.project.name}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {req.status === 'pending' && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>در انتظار بررسی راهبر</span>
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تایید شد (+{toPersianDigits(req.awarded_xp || 0)} XP)</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-500">
                            رد شده
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="py-2.5 space-y-2 text-xs">
                      {req.description && (
                        <p className="text-subtle leading-relaxed whitespace-pre-wrap bg-surface-2/60 p-2.5 rounded-xl border border-border/60">
                          {req.description}
                        </p>
                      )}

                      {req.status === 'approved' && (
                        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-2.5 space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-muted font-medium ml-1">عنوان تاییدشده:</span>
                              <span className="font-bold text-default">{req.final_task_name || req.title}</span>
                            </div>
                            <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold text-muted border border-border">
                              نوع: {req.award_type === 'reward' ? 'تشویقی' : 'تکمیل تسک'}
                            </span>
                          </div>
                          {req.reviewer_note && (
                            <div className="text-[11px] text-muted pt-1">
                              <span>پیام راهبر: </span>
                              <span className="text-default italic">«{req.reviewer_note}»</span>
                            </div>
                          )}
                        </div>
                      )}

                      {req.status === 'rejected' && req.reviewer_note && (
                        <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-2.5 text-rose-500">
                          <span className="font-bold ml-1">توضیح راهبر:</span>
                          <span>{req.reviewer_note}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/70 text-[11px] text-muted">
                      <span>ثبت: {formatToPersianDate(req.created_at)}</span>

                      {req.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(req.id)}
                          className="text-muted hover:text-rose-500 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>لغو درخواست</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : totalCount === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-sm text-muted">
            هیچ تسک یا مسئولیتی به شما محول نشده است.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Responsibilities Section */}
            {(activeTab === 'all' || activeTab === 'events') && eventItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-black text-default">مسئولیت‌های من در برگزاری رویدادها</h3>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted font-bold border border-border">
                    {eventItems.filter((it) => it.is_done).length} از {eventItems.length} انجام شده
                  </span>
                </div>

                <div className="space-y-3">
                  {eventItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border-[1.5px] p-4 sm:p-5 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] transition-all hover:-translate-y-0.5 ${
                        item.is_done
                          ? 'border-[#59BBAF]/40 bg-[#59BBAF]/5'
                          : 'border-border bg-surface hover:border-action/50'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Checkbox and Text */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleEventItem(item)}
                            className={`mt-0.5 cursor-pointer select-none active:scale-95 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-[1.5px] transition-all ${
                              item.is_done
                                ? 'border-action bg-action text-white shadow-xs'
                                : 'border-border-strong hover:border-action bg-surface'
                            }`}
                          >
                            {item.is_done && (
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-bold leading-relaxed sm:text-sm ${
                                item.is_done ? 'text-muted line-through' : 'text-default'
                              }`}
                            >
                              {item.title}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {item.event && (
                                <button
                                  onClick={() => router.push(`/events/${item.event_id}`)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-action hover:underline border border-border/70"
                                >
                                  <span>رویداد: {item.event.title}</span>
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                  </svg>
                                </button>
                              )}

                              <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] text-muted border border-border/70 font-medium">
                                بخش: {item.category_title}
                              </span>

                              {item.is_done && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                                  <span>انجام شده</span>
                                  <CheckCircle2 className="w-3 h-3" />
                                </span>
                              )}
                            </div>

                            {item.notes && (
                              <div className="mt-2 rounded-xl bg-surface-2 p-2.5 text-xs text-subtle border border-border/60">
                                <span className="font-bold text-action ml-1">یادداشت ثبت‌شده:</span>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Event Link button */}
                        <button
                          onClick={() => router.push(`/events/${item.event_id}`)}
                          className="shrink-0 rounded-xl bg-surface-2 border border-border px-3 py-1.5 text-xs font-bold text-muted hover:text-default hover:border-action/40 transition self-end sm:self-start"
                        >
                          مشاهده در رویداد
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kanban Project Tasks Section */}
            {(activeTab === 'all' || activeTab === 'projects') && tasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-500 border border-sky-500/30">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-black text-default">تسک‌های پروژه‌ها (بورد کانبان)</h3>
                </div>

                <div className="space-y-3">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/projects/${t.project_id}/board`)}
                      className="group w-full rounded-2xl border-[1.5px] border-border bg-surface p-4 sm:p-5 text-right shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] transition-all hover:-translate-y-0.5 hover:border-action/50 cursor-pointer"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-default group-hover:text-action transition-colors line-clamp-1">
                            {t.title}
                          </h4>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[11px] text-muted">پروژه:</span>
                            <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-action border border-border/60">
                              {t.project_name}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.status]}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}>
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                          {t.deadline && (
                            <span className="flex items-center gap-1 rounded-full bg-action/10 px-2 py-0.5 text-[11px] font-medium text-action">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatToPersianDate(t.deadline)}
                            </span>
                          )}
                          {t.xp_value > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              {t.xp_value}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Request XP Modal */}
      <RequestXpModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={loadMyRequests}
      />
    </div>
  )
}
