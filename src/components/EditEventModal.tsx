'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import PersianDatePicker from './PersianDatePicker'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { Profile, Event, EventStatus } from '@/utils/database.types'
import { Pencil, X } from 'lucide-react'

interface EditEventModalProps {
  isOpen: boolean
  onClose: () => void
  event: Event | null
  currentProfile: Profile
  onEventUpdated: (updatedEvent: Event) => void
}

const STATUS_OPTIONS: { key: EventStatus; label: string }[] = [
  { key: 'planning', label: 'در حال برنامه‌ریزی' },
  { key: 'ready', label: 'آماده برگزاری' },
  { key: 'in_progress', label: 'در حال برگزاری' },
  { key: 'completed', label: 'برگزار شده' },
  { key: 'cancelled', label: 'لغوشده' },
]

export default function EditEventModal({
  isOpen,
  onClose,
  event,
  currentProfile,
  onEventUpdated,
}: EditEventModalProps) {
  useBodyScrollLock(isOpen)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [leadId, setLeadId] = useState('')
  const [status, setStatus] = useState<EventStatus>('planning')
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const isAdmin = currentProfile.role === 'admin'

  useEffect(() => {
    if (event && isOpen) {
      setTitle(event.title || '')
      setDescription(event.description || '')
      setEventDate(event.event_date ? event.event_date.split('T')[0] : '')
      setLocation(event.location || '')
      setTargetAudience(event.target_audience || '')
      setLeadId(event.lead_id || currentProfile.id)
      setStatus(event.status || 'planning')
      setError('')
    }
  }, [event, isOpen, currentProfile.id])

  useEffect(() => {
    if (isAdmin && isOpen) {
      async function loadMembers() {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true })
        if (data) setMembers(data)
      }
      loadMembers()
    }
  }, [isAdmin, isOpen])

  if (!isOpen || !event) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return

    if (!title.trim()) {
      setError('لطفاً عنوان رویداد را وارد کنید')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: updatedEvent, error: updateErr } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate ? new Date(eventDate).toISOString() : null,
          location: location.trim() || null,
          target_audience: targetAudience.trim() || null,
          lead_id: isAdmin ? leadId : event.lead_id,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
        .select('*')
        .single()

      if (updateErr) throw updateErr
      if (!updatedEvent) throw new Error('خطا در به‌روزرسانی رویداد')

      onEventUpdated(updatedEvent)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطایی در ثبت تغییرات رخ داد')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/15 text-action border border-action/30 shadow-xs">
              <Pencil className="w-5 h-5 text-action" />
            </div>
            <div>
              <h2 className="text-base font-bold text-default sm:text-lg">ویرایش مشخصات رویداد</h2>
              <p className="text-xs text-muted">تغییر عنوان، زمان، مکان و وضعیت رویداد</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-default cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-subtle mb-1">
              عنوان / نام رویداد <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: رویداد پیچ‌دک و جذب سرمایه"
              className="rokad-input"
            />
          </div>

          {/* Status & Lead */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-subtle mb-1">
                وضعیت رویداد
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="rokad-input"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin ? (
              <div>
                <label className="block text-xs font-bold text-subtle mb-1">
                  مسئول / لید رویداد
                </label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="rokad-input"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role === 'admin' ? 'راهبر' : m.role === 'mentor' ? 'منتور' : 'عضو'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-subtle mb-1">
                  مسئول رویداد
                </label>
                <div className="rounded-xl border border-border/80 bg-surface-2/60 px-3.5 py-2 text-xs text-muted">
                  {event.lead_id === currentProfile.id ? `${currentProfile.full_name} (شما)` : 'تغییر فقط توسط راهبر'}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-subtle mb-1">
              توضیحات و اهداف رویداد
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="خلاصه‌ای از هدف برگزاری رویداد..."
              className="rokad-input resize-none"
            />
          </div>

          {/* Date & Location */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PersianDatePicker
              label="تاریخ برگزاری (شمسی)"
              value={eventDate}
              onChange={setEventDate}
              placeholder="انتخاب تاریخ..."
            />

            <div>
              <label className="block text-xs font-bold text-subtle mb-1">
                مکان یا لینک برگزاری
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="حضوری / گوگل میت / ..."
                className="rokad-input"
              />
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-xs font-bold text-subtle mb-1">
              مخاطبان هدف
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="مثال: اعضای باشگاه کسب‌وکار رکاد"
              className="rokad-input"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-default"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rokad-btn-primary px-5 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
