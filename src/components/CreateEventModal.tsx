'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { generateDefaultChecklistItems } from '@/constants/eventChecklistTemplate'
import PersianDatePicker from './PersianDatePicker'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { Profile, Event } from '@/utils/database.types'

interface CreateEventModalProps {
  currentProfile: Profile
  onClose: () => void
  onEventCreated: (event: Event) => void
}

export default function CreateEventModal({
  currentProfile,
  onClose,
  onEventCreated,
}: CreateEventModalProps) {
  useBodyScrollLock(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [leadId, setLeadId] = useState(currentProfile.id)
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const isAdmin = currentProfile.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      async function loadMembers() {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true })
        if (data) setMembers(data)
      }
      loadMembers()
    }
  }, [isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('لطفاً عنوان رویداد را وارد کنید')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Insert event
      const { data: newEvent, error: eventErr } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate ? new Date(eventDate).toISOString() : null,
          location: location.trim() || null,
          target_audience: targetAudience.trim() || null,
          lead_id: isAdmin ? leadId : currentProfile.id,
          status: 'planning',
        })
        .select('*')
        .single()

      if (eventErr) throw eventErr
      if (!newEvent) throw new Error('خطا در ثبت رویداد')

      // 2. Generate and insert default checklist items from Event.md
      const defaultItems = generateDefaultChecklistItems().map((item) => ({
        event_id: newEvent.id,
        category_key: item.category_key,
        category_title: item.category_title,
        title: item.title,
        sort_order: item.sort_order,
        is_done: false,
      }))

      const { error: itemsErr } = await supabase
        .from('event_checklist_items')
        .insert(defaultItems)

      if (itemsErr) {
        console.error('Error inserting checklist items:', itemsErr)
      }

      onEventCreated(newEvent)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطایی رخ داد')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain" dir="rtl">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-default sm:text-lg">ایجاد رویداد جدید</h2>
              <p className="text-xs text-muted">چک‌لیست ۸ بخشی استاندارد به‌صورت خودکار ایجاد خواهد شد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-default"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-subtle mb-1">
              عنوان / نام رویداد <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رویداد پیچ‌دک و جذب سرمایه"
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-default outline-none transition focus:border-action focus:ring-1 focus:ring-action"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-subtle mb-1">
              توضیحات و هدف رویداد
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="خلاصه‌ای از هدف برگزاری رویداد..."
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-default outline-none transition focus:border-action focus:ring-1 focus:ring-action"
            />
          </div>

          {/* Date & Location */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PersianDatePicker
              label="تاریخ برگزاری (شمسی)"
              value={eventDate}
              onChange={setEventDate}
              placeholder="انتخاب تاریخ رویداد..."
            />

            <div>
              <label className="block text-xs font-semibold text-subtle mb-1">
                مکان یا لینک برگزاری
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="حضوری / گوگل میت / ..."
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-default outline-none transition focus:border-action focus:ring-1 focus:ring-action"
              />
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-xs font-semibold text-subtle mb-1">
              مخاطبان هدف
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="مثال: اعضای باشگاه کسب‌وکار رکاد، دانش‌آموزان علاقه‌مند"
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-default outline-none transition focus:border-action focus:ring-1 focus:ring-action"
            />
          </div>

          {/* Event Lead (If Admin, can assign to someone else; if member, is fixed to current user) */}
          {isAdmin ? (
            <div>
              <label className="block text-xs font-semibold text-subtle mb-1">
                مسئول / لید رویداد
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-default outline-none transition focus:border-action focus:ring-1 focus:ring-action"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role === 'admin' ? 'مدیر' : 'عضو'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-surface-2/40 p-3 text-xs text-muted flex items-center gap-2">
              <span className="font-semibold text-default">مسئول رویداد:</span>
              <span className="text-action font-medium">{currentProfile.full_name} (شما)</span>
            </div>
          )}

          {/* Template Alert */}
          <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
            <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              به محض ثبت، چک‌لیست ۲۵ موردی شامل ۸ دسته‌ی راهبردی، محتوایی، تیمی، فنی، لجستیک و... آماده‌سازی خواهد شد.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-default"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'در حال ثبت...' : 'ایجاد و شروع چک‌لیست'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
