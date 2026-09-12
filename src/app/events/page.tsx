'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import CreateEventModal from '@/components/CreateEventModal'
import EditEventModal from '@/components/EditEventModal'
import DeleteEventModal from '@/components/DeleteEventModal'
import { formatToPersianDate } from '@/utils/jalaali'
import type { Profile, EventWithRelations, EventStatus, Event, Role } from '@/utils/database.types'

const STATUS_MAP: Record<EventStatus, { label: string; style: string }> = {
  planning: { label: 'در حال برنامه‌ریزی', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  ready: { label: 'آماده برگزاری', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'در حال برگزاری', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  completed: { label: 'برگزار شده', style: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  cancelled: { label: 'لغوشده', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

export default function EventsListPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null)
  const [eventToDelete, setEventToDelete] = useState<{ id: string; title: string } | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'assigned'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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

      const [profRes, eventsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select(`
          *,
          lead:profiles!events_lead_id_fkey(id, full_name),
          items:event_checklist_items(id, is_done, category_key, assignee_id)
        `).order('created_at', { ascending: false }),
      ])

      if (profRes.data) {
        setProfile({
          ...profRes.data,
          role: (user.user_metadata?.role || profRes.data.role) as Role,
        })
      }
      if (eventsRes.data) setEvents(eventsRes.data as EventWithRelations[])
      if (eventsRes.error) console.error('Error fetching events:', eventsRes.error)

      setLoading(false)
    }

    load()
  }, [])

  const filteredEvents = useMemo(() => {
    if (!profile) return []
    return events.filter((ev) => {
      // Tab filter
      if (activeFilter === 'mine' && ev.lead_id !== profile.id) return false
      if (activeFilter === 'assigned') {
        const hasAssignedItem = ev.items?.some((it) => it.assignee_id === profile.id)
        if (!hasAssignedItem) return false
      }
      // Status filter
      if (statusFilter !== 'all' && ev.status !== statusFilter) return false
      return true
    })
  }, [events, profile, activeFilter, statusFilter])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="h-10 w-48 rounded-2xl bg-surface-2/70" />
            <div className="h-10 w-36 rounded-2xl bg-surface-2/70" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-surface-2/70 border border-border/80" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Top Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-default">مدیریت و چک‌لیست رویدادها</h2>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
                {events.length} رویداد
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-action px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-action-hover active:scale-95 sm:text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            ایجاد رویداد جدید
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div className="flex items-center gap-1.5 rounded-xl bg-surface-2/80 p-1 overflow-x-auto max-w-full scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setActiveFilter('all')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-surface text-default shadow-sm'
                  : 'text-muted hover:text-default'
              }`}
            >
              همه رویدادها
            </button>
            <button
              onClick={() => setActiveFilter('mine')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeFilter === 'mine'
                  ? 'bg-surface text-default shadow-sm'
                  : 'text-muted hover:text-default'
              }`}
            >
              رویدادهای من (لید)
            </button>
            <button
              onClick={() => setActiveFilter('assigned')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeFilter === 'assigned'
                  ? 'bg-surface text-default shadow-sm'
                  : 'text-muted hover:text-default'
              }`}
            >
              مسئولیت‌های من
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted hidden sm:inline">وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-default outline-none transition focus:border-action"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="planning">در حال برنامه‌ریزی</option>
              <option value="ready">آماده برگزاری</option>
              <option value="in_progress">در حال برگزاری</option>
              <option value="completed">برگزار شده</option>
              <option value="cancelled">لغوشده</option>
            </select>
          </div>
        </div>

        {/* Event Cards Grid */}
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-default">رویدادی یافت نشد</h3>
            <p className="mt-1 text-xs text-muted">
              می‌توانید با کلیک روی «ایجاد رویداد جدید» اولین رویداد خود را ثبت و برنامه‌ریزی کنید.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((ev, i) => {
              const totalItems = ev.items?.length || 0
              const doneItems = ev.items?.filter((it) => it.is_done).length || 0
              const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
              const st = STATUS_MAP[ev.status] || STATUS_MAP.planning

              const gradients = [
                'from-emerald-500 to-teal-600',
                'from-sky-500 to-indigo-600',
                'from-amber-500 to-orange-600',
                'from-rose-500 to-pink-600',
                'from-violet-500 to-purple-600',
              ]
              const g = gradients[i % gradients.length]

              const canManage = profile?.role === 'admin' || ev.lead_id === profile?.id

              return (
                <div
                  key={ev.id}
                  onClick={() => router.push(`/events/${ev.id}`)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-[1.5px] border-border bg-surface shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-all duration-200 hover:-translate-y-1 hover:shadow-[3.5px_3.5px_0_#202A5A] dark:hover:shadow-[3.5px_3.5px_0_#59BBAF] hover:border-action/50 active:scale-[0.99] cursor-pointer"
                >
                  {/* Top Accent Gradient Bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${g}`} />

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                    {/* Top: Status & Date & Management actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-3 py-0.5 text-xs font-black ${st.style}`}>
                          {st.label}
                        </span>

                        {canManage && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEventToEdit(ev)
                              }}
                              className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-action"
                              title="ویرایش رویداد"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEventToDelete({ id: ev.id, title: ev.title })
                              }}
                              className="rounded-lg p-1 text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                              title="حذف رویداد"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {ev.event_date && (
                        <span className="text-xs font-bold text-muted flex items-center gap-1.5 bg-surface-2 px-2.5 py-0.5 rounded-lg border border-border/60">
                          <svg className="h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatToPersianDate(ev.event_date)}</span>
                        </span>
                      )}
                    </div>

                    {/* Middle: Title & Description */}
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-default group-hover:text-action transition-colors leading-snug line-clamp-1">
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className="mt-1.5 text-xs sm:text-sm text-muted leading-relaxed line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    {/* Meta info: Lead & Location */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1 text-subtle border border-border/70">
                        <span className="text-muted font-medium">مسئول:</span>
                        <span className="font-bold text-default">{ev.lead?.full_name || 'نامشخص'}</span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 rounded-xl bg-surface-2 px-2.5 py-1 text-muted border border-border/70">
                          <svg className="h-3.5 w-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span className="font-medium line-clamp-1">{ev.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Progress Bar & Checklist Readiness */}
                    <div className="pt-3 border-t border-border/70">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                        <span className="text-muted font-bold">میزان آمادگی رویداد</span>
                        <span className="font-black text-default">{pct}٪ ({doneItems}/{totalItems})</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-border/40">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && profile && (
        <CreateEventModal
          currentProfile={profile}
          onClose={() => setShowCreateModal(false)}
          onEventCreated={(newEvent) => {
            setShowCreateModal(false)
            router.push(`/events/${newEvent.id}`)
          }}
        />
      )}

      {/* Edit Modal */}
      {eventToEdit && profile && (
        <EditEventModal
          isOpen={!!eventToEdit}
          event={eventToEdit}
          currentProfile={profile}
          onClose={() => setEventToEdit(null)}
          onEventUpdated={(updated) => {
            setEvents((prev) =>
              prev.map((e) =>
                e.id === updated.id
                  ? {
                      ...e,
                      ...updated,
                    }
                  : e
              )
            )
            setEventToEdit(null)
          }}
        />
      )}

      {/* Delete Modal */}
      {eventToDelete && (
        <DeleteEventModal
          isOpen={!!eventToDelete}
          eventId={eventToDelete.id}
          eventTitle={eventToDelete.title}
          onClose={() => setEventToDelete(null)}
          onEventDeleted={(deletedId) => {
            setEvents((prev) => prev.filter((e) => e.id !== deletedId))
            setEventToDelete(null)
          }}
        />
      )}
    </div>
  )
}
