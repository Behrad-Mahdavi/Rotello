'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Task, Profile, Checklist, ChecklistItem, TaskReport } from '@/utils/database.types'

interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
  profile: Profile
  onTaskDeleted?: (taskId: string) => void
}

type WithItems = Checklist & { items: ChecklistItem[] }
type WithAuthor = TaskReport & { author: { full_name: string } }

export default function TaskDetailModal({ taskId, onClose, profile, onTaskDeleted }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [assignees, setAssignees] = useState<Profile[]>([])
  const [checklists, setChecklists] = useState<WithItems[]>([])
  const [reports, setReports] = useState<WithAuthor[]>([])
  const [reportContent, setReportContent] = useState('')
  const [isAssignee, setIsAssignee] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      if (t) setTask(t)
      const { data: cls } = await supabase.from('checklists').select('*, items:checklist_items(*)').eq('task_id', taskId).order('sort_order')
      if (cls) setChecklists(cls as unknown as WithItems[])
      const { data: rpts } = await supabase.from('task_reports').select('*, author:profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: true })
      if (rpts) setReports(rpts as unknown as WithAuthor[])
      const { data: aa } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId)
      if (aa) {
        const userIds = aa.map((a) => a.user_id)
        setIsAssignee(userIds.includes(profile.id))
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('*').in('id', userIds)
          if (profs) setAssignees(profs)
        }
      }
      setLoading(false)
    }
    load()
  }, [taskId])

  async function toggleChecklistItem(item: ChecklistItem) {
    const newDone = !item.is_done
    const { error: err } = await supabase.from('checklist_items').update({
      is_done: newDone, done_by: newDone ? profile.id : null, done_at: newDone ? new Date().toISOString() : null,
    }).eq('id', item.id)
    if (!err) {
      setChecklists((prev) => prev.map((cl) => ({
        ...cl, items: cl.items.map((i) => i.id === item.id ? { ...i, is_done: newDone, done_by: newDone ? profile.id : null, done_at: newDone ? new Date().toISOString() : null } : i),
      })))
    }
  }

  async function handleAddReport(e: React.FormEvent) {
    e.preventDefault()
    if (!reportContent.trim()) return
    const { data, error: err } = await supabase.from('task_reports').insert({ task_id: taskId, author_id: profile.id, content: reportContent })
      .select('*, author:profiles(full_name)').single()
    if (err) { setError(err.message); return }
    setReports((prev) => [...prev, data as unknown as WithAuthor])
    setReportContent('')
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-surface p-8 text-sm text-muted shadow-sm">...</div>
    </div>
  )
  if (!task) return null

  const canEdit = profile.role === 'admin'
  const stageClass: Record<string, string> = {
    backlog: 'bg-stage-backlog/12 text-stage-backlog',
    todo: 'bg-stage-todo/12 text-stage-todo',
    in_progress: 'bg-stage-in-progress/12 text-stage-in-progress',
    done: 'bg-stage-done/12 text-stage-done',
  }

  async function handleDeleteTask() {
    if (!confirm('آیا از حذف این تسک اطمینان دارید؟')) return
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId)
    if (err) { setError(err.message); return }
    onTaskDeleted?.(taskId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-lg sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-surface p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-default">{task.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stageClass[task.status]}`}>
                  {task.status === 'backlog' ? 'Backlog' : task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : 'Done'}
                </span>
                {task.xp_value > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-xp">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {task.xp_value} XP
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && (
                <button onClick={handleDeleteTask}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-danger/60 transition-colors hover:bg-danger-subtle hover:text-danger">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-default">✕</button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:space-y-6 sm:p-5">
          {task.description && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-muted">توضیحات</h4>
              <p className="text-sm text-default whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}

          {assignees.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted">مسئولین</h4>
              <div className="flex flex-wrap gap-1.5">
                {assignees.map((a) => (
                  <span key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-action-subtle px-2.5 py-1 text-xs font-medium text-action">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-action text-[9px] font-bold text-on-dark">
                      {a.full_name.charAt(0)}
                    </span>
                    {a.full_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {checklists.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-semibold text-muted">چک‌لیست‌ها</h4>
              {checklists.map((cl) => (
                <div key={cl.id} className="mb-3 last:mb-0">
                  <h5 className="text-sm font-medium text-default mb-1.5">{cl.title}</h5>
                  <div className="space-y-1">
                    {cl.items.map((item) => {
                      const canToggle = canEdit || isAssignee
                      return (
                        <label key={item.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${canToggle ? 'cursor-pointer hover:bg-canvas' : ''}`}>
                          <input type="checkbox" checked={item.is_done}
                            onChange={() => canToggle && toggleChecklistItem(item)}
                            disabled={!canToggle}
                            className="h-4 w-4 rounded-md text-action focus:ring-action/30 disabled:opacity-40" />
                          <span className={`${item.is_done ? 'line-through text-muted' : 'text-default'}`}>{item.content}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <h4 className="mb-3 text-xs font-semibold text-muted">گزارش‌ها</h4>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {reports.length === 0 && <p className="text-sm text-muted py-4 text-center">هنوز گزارشی ثبت نشده است.</p>}
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl bg-canvas p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-medium text-subtle">{report.author?.full_name || 'کاربر'}</span>
                    <span>{new Date(report.created_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-default whitespace-pre-wrap leading-relaxed">{report.content}</p>
                </div>
              ))}
            </div>

            {(isAssignee || canEdit) && (
              <form onSubmit={handleAddReport} className="mt-3">
                <textarea value={reportContent} onChange={(e) => setReportContent(e.target.value)}
                  placeholder="افزودن گزارش جدید..." rows={2}
                  className="block w-full rounded-xl bg-canvas px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20" />
                {error && <div className="mt-1.5 text-sm text-danger">{error}</div>}
                <button type="submit" disabled={!reportContent.trim()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-action px-4 py-2 text-xs font-medium text-on-dark transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
                  ثبت گزارش
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
