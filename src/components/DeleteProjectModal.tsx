'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Trash2 } from 'lucide-react'

interface DeleteProjectModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string | null
  projectName: string
  onProjectDeleted: (deletedId: string) => void
}

export default function DeleteProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onProjectDeleted,
}: DeleteProjectModalProps) {
  useBodyScrollLock(isOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  if (!isOpen || !projectId) return null

  async function handleDelete() {
    if (!projectId) return
    setLoading(true)
    setError('')

    try {
      // 1. Fetch task ids belonging to this project
      const { data: projectTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)

      if (projectTasks && projectTasks.length > 0) {
        const taskIds = projectTasks.map((t: { id: string }) => t.id)
        // 2. Delete task_assignees for those tasks
        await supabase
          .from('task_assignees')
          .delete()
          .in('task_id', taskIds)

        // 3. Delete tasks
        await supabase
          .from('tasks')
          .delete()
          .eq('project_id', projectId)
      }

      // 4. Delete project record
      const { error: projectErr } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (projectErr) {
        throw projectErr
      }

      onProjectDeleted(projectId)
      onClose()
    } catch (err: unknown) {
      console.error('Error deleting project:', err)
      const msg = err instanceof Error ? err.message : 'خطا در حذف پروژه'
      setError(msg)
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
        className="w-full max-w-sm rounded-3xl border-[1.5px] border-border bg-surface p-6 shadow-[4px_4px_0_#C60036] text-right animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/30 mb-4 mx-auto shadow-xs">
          <Trash2 className="w-6 h-6 text-rose-500" />
        </div>

        <h3 className="text-base font-black text-default text-center mb-1.5">
          حذف پروژه
        </h3>
        <p className="text-xs text-muted text-center mb-5 leading-relaxed font-medium">
          آیا از حذف پروژه <span className="font-bold text-default">«{projectName}»</span> اطمینان دارید؟ تمام تسک‌ها و وابستگی‌های این پروژه حذف خواهند شد و این عملیات قابل بازگشت نیست.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-500 text-center">
            {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="flex-1 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs active:scale-95 cursor-pointer"
          >
            {loading ? 'در حال حذف...' : 'بله، حذف کن'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-muted hover:text-default transition-colors cursor-pointer"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  )
}
