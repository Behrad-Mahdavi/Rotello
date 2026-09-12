'use client'

import { useEffect, useState, use, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import EditEventModal from '@/components/EditEventModal'
import DeleteEventModal from '@/components/DeleteEventModal'
import { EVENT_CATEGORIES } from '@/constants/eventChecklistTemplate'
import { formatToPersianDate } from '@/utils/jalaali'
import type { Profile, Event, EventStatus, EventChecklistItemWithRelations, Role } from '@/utils/database.types'
import { Star } from 'lucide-react'

const STATUS_MAP: Record<EventStatus, { label: string; style: string }> = {
  planning: { label: 'در حال برنامه‌ریزی', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  ready: { label: 'آماده برگزاری', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'در حال برگزاری', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  completed: { label: 'برگزار شده', style: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  cancelled: { label: 'لغوشده', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [lead, setLead] = useState<Profile | null>(null)
  const [items, setItems] = useState<EventChecklistItemWithRelations[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    strategy: true,
    content: true,
    team: true,
    tech: true,
    logistics: false,
    marketing: false,
    risk: false,
    retro: false,
  })
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const isLeadOrAdmin = useMemo(() => {
    if (!profile || !event) return false
    return profile.role === 'admin' || event.lead_id === profile.id
  }, [profile, event])

  useEffect(() => {
    if (!eventId) return

    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        router.push('/login')
        return
      }

      const [profRes, eventRes, itemsRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*, lead:profiles!events_lead_id_fkey(*)').eq('id', eventId).single(),
        supabase.from('event_checklist_items').select(`
          *,
          assignee:profiles!event_checklist_items_assignee_id_fkey(id, full_name),
          done_by_user:profiles!event_checklist_items_done_by_fkey(id, full_name)
        `).eq('event_id', eventId).order('sort_order', { ascending: true }),
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      ])

      if (profRes.data) {
        setProfile({
          ...profRes.data,
          role: (user.user_metadata?.role || profRes.data.role) as Role,
        })
      }
      if (membersRes.data) setMembers(membersRes.data)

      if (eventRes.data) {
        const ev = eventRes.data
        setEvent(ev)
        if (ev.lead) setLead(ev.lead as unknown as Profile)
      }

      if (itemsRes.data) {
        setItems(itemsRes.data as EventChecklistItemWithRelations[])
      }

      setLoading(false)
    }

    loadData()
  }, [eventId])

  // Group items by category
  const groupedItems = useMemo(() => {
    const map: Record<string, EventChecklistItemWithRelations[]> = {}
    for (const cat of EVENT_CATEGORIES) {
      map[cat.key] = []
    }
    for (const item of items) {
      if (!map[item.category_key]) map[item.category_key] = []
      map[item.category_key].push(item)
    }
    return map
  }, [items])

  // Overall metrics
  const totalItems = items.length
  const doneItems = items.filter((it) => it.is_done).length
  const overallPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  async function handleToggleItem(item: EventChecklistItemWithRelations) {
    if (!profile) return
    const newDone = !item.is_done
    const updatePayload = {
      is_done: newDone,
      done_by: newDone ? profile.id : null,
      done_at: newDone ? new Date().toISOString() : null,
    }

    // Optimistic update
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              ...updatePayload,
              done_by_user: newDone ? { id: profile.id, full_name: profile.full_name } : null,
            }
          : it
      )
    )

    const { error } = await supabase
      .from('event_checklist_items')
      .update(updatePayload)
      .eq('id', item.id)

    if (error) {
      console.error('Error toggling item:', error)
      // Revert on error
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)))
    }
  }

  async function handleAssigneeChange(itemId: string, newAssigneeId: string) {
    const val = newAssigneeId === 'none' ? null : newAssigneeId
    const targetMember = members.find((m) => m.id === val)

    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              assignee_id: val,
              assignee: targetMember ? { id: targetMember.id, full_name: targetMember.full_name } : null,
            }
          : it
      )
    )

    const { error } = await supabase
      .from('event_checklist_items')
      .update({ assignee_id: val })
      .eq('id', itemId)

    if (error) {
      console.error('Error updating assignee:', error)
    }
  }

  async function handleSaveNote(itemId: string) {
    const { error } = await supabase
      .from('event_checklist_items')
      .update({ notes: noteText.trim() || null })
      .eq('id', itemId)

    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, notes: noteText.trim() || null } : it))
      )
      setEditingNoteId(null)
      setNoteText('')
    }
  }

  async function handleAddCustomItem(categoryKey: string, categoryTitle: string) {
    if (!newItemTitle.trim() || !event) return
    const maxSort = items.reduce((max, it) => Math.max(max, it.sort_order), 0)

    const { data: created, error } = await supabase
      .from('event_checklist_items')
      .insert({
        event_id: event.id,
        category_key: categoryKey,
        category_title: categoryTitle,
        title: newItemTitle.trim(),
        sort_order: maxSort + 1,
        is_done: false,
      })
      .select('*')
      .single()

    if (!error && created) {
      setItems((prev) => [...prev, created as EventChecklistItemWithRelations])
      setNewItemCategory(null)
      setNewItemTitle('')
    }
  }

  async function handleUpdateStatus(newStatus: EventStatus) {
    if (!event) return
    setSavingStatus(true)
    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', event.id)

    if (!error) {
      setEvent((prev) => (prev ? { ...prev, status: newStatus } : null))
    }
    setSavingStatus(false)
  }

  function toggleCategory(catKey: string) {
    setOpenCategories((prev) => ({ ...prev, [catKey]: !prev[catKey] }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          در حال بارگذاری چک‌لیست رویداد...
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader profile={profile} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-semibold text-default">رویداد مورد نظر یافت نشد.</p>
          <button
            onClick={() => router.push('/events')}
            className="rounded-xl bg-surface-2 px-4 py-2 text-xs text-subtle hover:text-default"
          >
            بازگشت به لیست رویدادها
          </button>
        </div>
      </div>
    )
  }

  const st = STATUS_MAP[event.status] || STATUS_MAP.planning

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted">
          <button
            onClick={() => router.push('/events')}
            className="flex items-center gap-1 font-medium text-muted transition hover:text-default"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            رویدادها
          </button>
          <span>/</span>
          <span className="text-default font-medium line-clamp-1">{event.title}</span>
        </div>

        {/* Hero Card / Event Summary */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm mb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${st.style}`}>
                  {st.label}
                </span>

                {isLeadOrAdmin && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      disabled={savingStatus}
                      value={event.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as EventStatus)}
                      className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-subtle outline-none transition focus:border-action"
                    >
                      <option value="planning">تغییر به: در حال برنامه‌ریزی</option>
                      <option value="ready">تغییر به: آماده برگزاری</option>
                      <option value="in_progress">تغییر به: در حال برگزاری</option>
                      <option value="completed">تغییر به: برگزار شده</option>
                      <option value="cancelled">تغییر به: لغوشده</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-subtle transition hover:border-action/40 hover:bg-action/10 hover:text-action"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      ویرایش رویداد
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      حذف رویداد
                    </button>
                  </div>
                )}
              </div>

              <h1 className="text-xl font-bold text-default sm:text-2xl">{event.title}</h1>
              {event.description && (
                <p className="text-xs text-muted sm:text-sm max-w-2xl">{event.description}</p>
              )}

              {/* Badges Info */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-subtle">
                  <span className="text-muted">مسئول رویداد:</span>
                  <span className="font-bold text-action">{lead?.full_name || 'نامشخص'}</span>
                </div>

                {event.event_date && (
                  <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-subtle">
                    <svg className="h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatToPersianDate(event.event_date)}</span>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-subtle">
                    <svg className="h-3.5 w-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Readiness Gauge Widget */}
            <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-2/60 border border-border/60 p-5 min-w-[200px] text-center">
              <span className="text-xs font-medium text-muted">میزان آمادگی کل</span>
              <div className="my-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-default">{overallPct}%</span>
              </div>
              <div className="h-2.5 w-36 overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallPct >= 80 ? 'bg-emerald-500' : overallPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <span className="mt-2 text-[11px] text-muted font-medium">
                {doneItems} از {totalItems} بند تایید شده
              </span>
            </div>
          </div>
        </div>

        {/* Golden Rule Callout (from Event.md) */}
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 text-amber-200 shadow-sm flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-400 sm:text-sm">قانون طلایی برگزاری رویداد</h4>
            <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
              اگه یک آیتم از این چک‌لیست رو <strong>«فکر می‌کنم حله»</strong> جواب می‌دی، یعنی هنوز چک نشده. فقط چیزهایی که واقعاً تست، تمرین و کتباً تایید شدن رو تیک بزن.
            </p>
          </div>
        </div>

        {/* 8 Categories Accordions */}
        <div className="space-y-4">
          {EVENT_CATEGORIES.map((cat, idx) => {
            const catItems = groupedItems[cat.key] || []
            const catDone = catItems.filter((it) => it.is_done).length
            const catTotal = catItems.length
            const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0
            const isOpen = openCategories[cat.key] ?? false

            return (
              <div
                key={cat.key}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all"
              >
                {/* Category Header Bar */}
                <button
                  onClick={() => toggleCategory(cat.key)}
                  className="flex w-full items-center justify-between p-4 text-right transition hover:bg-surface-2/40 sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-xs font-bold text-action">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-default sm:text-base">{cat.title}</h3>
                      {cat.description && (
                        <p className="text-[11px] text-muted hidden sm:block">{cat.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        catPct === 100
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : catPct > 0
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {catDone}/{catTotal} ({catPct}%)
                    </span>

                    <svg
                      className={`h-5 w-5 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Category Content */}
                {isOpen && (
                  <div className="border-t border-border/60 bg-surface-2/10 p-3 sm:p-5 space-y-3">
                    {catItems.map((item) => {
                      const canToggle = isLeadOrAdmin || item.assignee_id === profile?.id
                      const isEditingNote = editingNoteId === item.id

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3.5 transition-all ${
                            item.is_done
                              ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                              : 'border-border bg-surface'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            {/* Checkbox & Title */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                disabled={!canToggle}
                                onClick={() => handleToggleItem(item)}
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all ${
                                  item.is_done
                                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                    : 'border-border-strong hover:border-action bg-surface'
                                } ${!canToggle ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
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

                                {/* Notes badge / preview */}
                                {item.notes && !isEditingNote && (
                                  <div className="mt-2 rounded-lg bg-surface-2 p-2.5 text-xs text-subtle border border-border/40">
                                    <span className="font-semibold text-action ml-1">پاسخ / یادداشت:</span>
                                    <span className="whitespace-pre-wrap">{item.notes}</span>
                                  </div>
                                )}

                                {/* Done metadata */}
                                {item.is_done && item.done_by_user && (
                                  <div className="mt-1 text-[10px] text-emerald-400">
                                    تایید شده توسط {item.done_by_user.full_name}
                                    {item.done_at && ` در ${formatToPersianDate(item.done_at)}`}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions & Assignee */}
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                              {/* Assignee selector */}
                              {isLeadOrAdmin ? (
                                <select
                                  value={item.assignee_id || 'none'}
                                  onChange={(e) => handleAssigneeChange(item.id, e.target.value)}
                                  className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-[11px] text-subtle outline-none transition focus:border-action"
                                >
                                  <option value="none">بدون مسئول (تیم)</option>
                                  {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      مسئول: {m.full_name}
                                    </option>
                                  ))}
                                </select>
                              ) : item.assignee ? (
                                <span className="rounded-md bg-surface-2 px-2 py-1 text-[11px] text-action font-medium">
                                  مسئول: {item.assignee.full_name}
                                </span>
                              ) : null}

                              {/* Note toggle button */}
                              <button
                                onClick={() => {
                                  if (isEditingNote) {
                                    setEditingNoteId(null)
                                  } else {
                                    setEditingNoteId(item.id)
                                    setNoteText(item.notes || '')
                                  }
                                }}
                                className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-muted hover:text-default transition"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>{item.notes ? 'ویرایش یادداشت' : '+ ثبت یادداشت'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Inline Note Editor */}
                          {isEditingNote && (
                            <div className="mt-3 border-t border-border/50 pt-3 space-y-2">
                              <textarea
                                rows={2}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="پاسخ، مستندات، لینک اسلاید یا هماهنگی‌های لازم برای این بند را وارد کنید..."
                                className="w-full rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-default outline-none transition focus:border-action"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-default"
                                >
                                  انصراف
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveNote(item.id)}
                                  className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                                >
                                  ذخیره یادداشت
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add Custom Item Button */}
                    {isLeadOrAdmin && (
                      <div className="pt-2">
                        {newItemCategory === cat.key ? (
                          <div className="flex items-center gap-2 rounded-xl border border-action/40 bg-surface p-2.5">
                            <input
                              type="text"
                              value={newItemTitle}
                              onChange={(e) => setNewItemTitle(e.target.value)}
                              placeholder="عنوان بند یا سوال جدید را وارد کنید..."
                              className="flex-1 bg-transparent px-2 text-xs text-default outline-none"
                            />
                            <button
                              onClick={() => handleAddCustomItem(cat.key, cat.title)}
                              className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-white hover:bg-action-hover"
                            >
                              افزودن
                            </button>
                            <button
                              onClick={() => {
                                setNewItemCategory(null)
                                setNewItemTitle('')
                              }}
                              className="rounded-lg px-2 py-1 text-xs text-muted hover:text-default"
                            >
                              انصراف
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setNewItemCategory(cat.key)
                              setNewItemTitle('')
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-action hover:underline"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            افزودن بند اختصاصی به این بخش
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && profile && event && (
        <EditEventModal
          isOpen={showEditModal}
          event={event}
          currentProfile={profile}
          onClose={() => setShowEditModal(false)}
          onEventUpdated={(updated) => {
            setEvent(updated)
            if (updated.lead_id !== event.lead_id) {
              const newLead = members.find((m) => m.id === updated.lead_id) || null
              setLead(newLead)
            }
            setShowEditModal(false)
          }}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && event && (
        <DeleteEventModal
          isOpen={showDeleteModal}
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowDeleteModal(false)}
          onEventDeleted={() => {
            router.push('/events')
          }}
        />
      )}
    </div>
  )
}
