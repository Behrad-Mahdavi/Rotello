'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { formatToPersianDate } from '@/utils/jalaali'
import type { Profile, Task, EventChecklistItem } from '@/utils/database.types'

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
  const [activeTab, setActiveTab] = useState<'all' | 'projects' | 'events'>('all')
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

      const [profRes, assignRes, eventRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('task_assignees').select('task_id, task:tasks(*, project:projects(name))').eq('user_id', user.id),
        supabase.from('event_checklist_items').select(`
          *,
          event:events!event_checklist_items_event_id_fkey(id, title, event_date, status)
        `).eq('assignee_id', user.id).order('created_at', { ascending: false }),
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

      setLoading(false)
    }
    load()
  }, [])

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
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          در حال بارگذاری تسک‌ها...
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {/* Header Title & Summary */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-default">تسک‌ها و مسئولیت‌های من</h2>
            <p className="text-xs text-muted sm:text-sm">
              {totalCount} مورد محول‌شده ({tasks.length} تسک پروژه، {eventItems.length} مسئولیت در رویدادها)
            </p>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-2/80 p-1 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'all' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              همه ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'projects' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              تسک‌های پروژه ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'events' ? 'bg-surface text-default shadow-sm' : 'text-muted hover:text-default'
              }`}
            >
              مسئولیت‌های رویداد ({eventItems.length})
            </button>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-sm text-muted">
            هیچ تسک یا مسئولیتی به شما محول نشده است.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Responsibilities Section */}
            {(activeTab === 'all' || activeTab === 'events') && eventItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400 text-xs">
                    📅
                  </div>
                  <h3 className="text-sm font-bold text-default">مسئولیت‌های من در برگزاری رویدادها</h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted font-semibold">
                    {eventItems.filter((it) => it.is_done).length} از {eventItems.length} انجام شده
                  </span>
                </div>

                <div className="space-y-2.5">
                  {eventItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 shadow-sm transition-all ${
                        item.is_done
                          ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
                          : 'border-border bg-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Checkbox and Text */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleEventItem(item)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all ${
                              item.is_done
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
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
                              className={`text-xs font-semibold leading-relaxed sm:text-sm ${
                                item.is_done ? 'text-muted line-through' : 'text-default'
                              }`}
                            >
                              {item.title}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {item.event && (
                                <button
                                  onClick={() => router.push(`/events/${item.event_id}`)}
                                  className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-action hover:underline"
                                >
                                  <span>رویداد: {item.event.title}</span>
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                  </svg>
                                </button>
                              )}

                              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                                بخش: {item.category_title}
                              </span>

                              {item.is_done && (
                                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                  انجام شده ✓
                                </span>
                              )}
                            </div>

                            {item.notes && (
                              <div className="mt-2 rounded-lg bg-surface-2 p-2 text-xs text-subtle border border-border/40">
                                <span className="font-semibold text-action ml-1">یادداشت ثبت‌شده:</span>
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Event Link button */}
                        <button
                          onClick={() => router.push(`/events/${item.event_id}`)}
                          className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted hover:text-default transition self-end sm:self-start"
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
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/20 text-sky-400 text-xs">
                    📋
                  </div>
                  <h3 className="text-sm font-bold text-default">تسک‌های پروژه‌ها (بورد کانبان)</h3>
                </div>

                <div className="space-y-2.5">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/projects/${t.project_id}/board`)}
                      className="group w-full rounded-xl border border-border bg-surface p-4 text-right shadow-sm transition-all hover:border-border-strong hover:shadow-md sm:p-5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-default group-hover:text-action transition-colors line-clamp-1">
                            {t.title}
                          </h4>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[11px] text-muted">پروژه:</span>
                            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-action">
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
    </div>
  )
}
