'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Trash2 } from 'lucide-react'

interface DeleteEventModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string | null
  eventTitle: string
  onEventDeleted: (deletedId: string) => void
}

export default function DeleteEventModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  onEventDeleted,
}: DeleteEventModalProps) {
  useBodyScrollLock(isOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  if (!isOpen || !eventId) return null

  async function handleDelete() {
    if (!eventId) return
    setLoading(true)
    setError('')

    try {
      // 1. Delete associated checklist items first to prevent FK constraint errors
      const { error: itemsErr } = await supabase
        .from('event_checklist_items')
        .delete()
        .eq('event_id', eventId)

      if (itemsErr) {
        console.error('Error deleting checklist items:', itemsErr)
      }

      // 2. Delete the event record
      const { error: eventErr } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (eventErr) throw eventErr

      onEventDeleted(eventId)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطایی در حذف رویداد رخ داد')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-xs">
          <Trash2 className="w-6 h-6 text-rose-500" />
        </div>

        <h3 className="text-center text-base font-extrabold text-default">
          حذف رویداد «{eventTitle}»
        </h3>

        <p className="mt-2 text-center text-xs text-muted leading-relaxed">
          آیا از حذف این رویداد اطمینان دارید؟ تمام بندها، تخصیص‌ها و پیشرفت‌های چک‌لیست مربوط به آن به‌صورت دائمی پاک خواهد شد و این عملیات قابل بازگشت نیست.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-center text-xs text-rose-500">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl bg-surface-2 py-2.5 text-xs font-bold text-default transition hover:bg-surface-3"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'در حال حذف...' : 'حذف قطعی رویداد'}
          </button>
        </div>
      </div>
    </div>
  )
}
