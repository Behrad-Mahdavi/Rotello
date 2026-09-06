'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

import MemberProfileModal from './MemberProfileModal'
import PersianDatePicker from './PersianDatePicker'
import { formatToPersianDate } from '@/utils/jalaali'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { Task, Profile, Checklist, ChecklistItem, TaskReport } from '@/utils/database.types'


interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
  profile: Profile
  onTaskDeleted?: (taskId: string) => void
  onTaskUpdated?: (task: Task) => void
}

type WithItems = Checklist & { items: ChecklistItem[] }
type WithAuthor = TaskReport & { author: { full_name: string } }

export default function TaskDetailModal({ taskId, onClose, profile, onTaskDeleted, onTaskUpdated }: TaskDetailModalProps) {
  useBodyScrollLock(true)
  const [task, setTask] = useState<Task | null>(null)
  const [assignees, setAssignees] = useState<Profile[]>([])
  const [checklists, setChecklists] = useState<WithItems[]>([])
  const [reports, setReports] = useState<WithAuthor[]>([])
  const [reportContent, setReportContent] = useState('')
  const [isAssignee, setIsAssignee] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMemberProfileId, setSelectedMemberProfileId] = useState<string | null>(null)


  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editXpValue, setEditXpValue] = useState(0)
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState<Task['priority']>('normal')
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([])
  const [allMembers, setAllMembers] = useState<Profile[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const memberDropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [tRes, clsRes, rptsRes, aaRes, memRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('checklists').select('*, items:checklist_items(*)').eq('task_id', taskId).order('sort_order'),
        supabase.from('task_reports').select('*, author:profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_assignees').select('user_id, profile:profiles(*)').eq('task_id', taskId),
        profile.role === 'admin' ? supabase.from('profiles').select('*').order('full_name') : null,
      ])
      const t = tRes.data
      const cls = clsRes.data
      const rpts = rptsRes.data
      const aa = aaRes.data
      if (t) setTask(t)
      if (cls) setChecklists(cls as unknown as WithItems[])
      if (rpts) setReports(rpts as unknown as WithAuthor[])
      if (aa) {
        const userIds = aa.map((a: { user_id: string }) => a.user_id)
        const profsList = (aa as unknown as { profile: Profile | null }[])
          .map((a) => a.profile)
          .filter(Boolean) as Profile[]
        setIsAssignee(userIds.includes(profile.id))
        setEditAssigneeIds(userIds)
        setAssignees(profsList)
      }
      if (memRes) setAllMembers(memRes.data as unknown as Profile[])
      setLoading(false)
    }
    load()
  }, [taskId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function startEditing() {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditXpValue(task.xp_value)
    setEditDeadline(task.deadline ? task.deadline.slice(0, 10) : '')
    setEditPriority(task.priority)
    setMemberSearch('')
    setMemberDropdownOpen(false)
    setIsEditing(true)
  }

  async function handleSave() {
    if (!task) return
    if (!editTitle.trim()) { setError('عنوان تسک نمی‌تواند خالی باشد.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('tasks').update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      xp_value: editXpValue,
      deadline: editDeadline || null,
      priority: editPriority,
    }).eq('id', taskId)
    if (err) { setError(err.message); setSaving(false); return }

    const { data: existing, error: errExisting } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId)
    if (errExisting) { setError(errExisting.message); setSaving(false); return }
    const currentIds: string[] = ((existing as { user_id: string }[]) || []).map((r) => r.user_id)
    const toRemove = currentIds.filter((id) => !editAssigneeIds.includes(id))
    const toAdd = editAssigneeIds.filter((id) => !currentIds.includes(id))

    const ops: Promise<{ error: { message: string } | null }>[] = []
    if (toRemove.length > 0) ops.push(supabase.from('task_assignees').delete().eq('task_id', taskId).in('user_id', toRemove))
    if (toAdd.length > 0) ops.push(supabase.from('task_assignees').insert(toAdd.map((user_id) => ({ task_id: taskId, user_id }))))
    const results = await Promise.all(ops)
    const assignErr = results.find((r) => r.error)
    if (assignErr) { setError(assignErr.error!.message); setSaving(false); return }

    const { data: profs } = await supabase.from('profiles').select('*').in('id', editAssigneeIds.length > 0 ? editAssigneeIds : [''])
    if (profs) setAssignees(profs as unknown as Profile[])
    setIsAssignee(editAssigneeIds.includes(profile.id))

    const updated: Task = { ...task, title: editTitle.trim(), description: editDescription.trim() || null, xp_value: editXpValue, deadline: editDeadline || null, priority: editPriority }
    setTask(updated)
    onTaskUpdated?.(updated)
    setIsEditing(false)
    setSaving(false)
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="rounded-lg bg-surface p-8 text-sm text-muted shadow-lg">...</div>
    </div>
  )
  if (!task) return null

  const canEdit = profile.role === 'admin'
  const STATUS_BADGE: Record<string, string> = {
    backlog: 'bg-gray-500/10 text-gray-400',
    todo: 'bg-slate-500/10 text-slate-400',
    in_progress: 'bg-emerald-500/10 text-emerald-400',
    review: 'bg-amber-500/10 text-amber-400',
    done: 'bg-teal-500/10 text-teal-400',
  }
  const PRIORITY_BADGE: Record<string, string> = {
    normal: 'bg-sky-500/10 text-sky-400',
    important: 'bg-orange-500/10 text-orange-400',
    urgent: 'bg-rose-500/10 text-rose-400',
  }
  const PRIORITY_LABEL: Record<string, string> = {
    normal: 'عادی',
    important: 'مهم',
    urgent: 'فوری',
  }

  const STATUS_LABEL: Record<string, string> = {
    backlog: 'بک‌لاگ',
    todo: 'در صف انجام',
    in_progress: 'در حال انجام',
    review: 'در حال بازبینی',
    done: 'تکمیل‌شده',
  }

  const NEXT_STATUS: Record<string, string | null> = {
    backlog: 'todo',
    todo: 'in_progress',
    in_progress: 'review',
    review: profile?.role === 'admin' ? 'done' : null,
    done: null,
  }

  async function handleMoveStatus() {
    const next = NEXT_STATUS[task!.status]
    if (!next) return
    const { error: err } = await supabase.rpc('move_task_status', { p_task_id: taskId, p_new_status: next })
    if (err) { setError(err.message); return }
    setTask((prev) => prev ? { ...prev, status: next as Task['status'] } : prev)
    setError('')
  }

  function handleDeleteTask() {
    setShowDeleteConfirm(true)
  }

  async function confirmDeleteTask() {
    setIsDeleting(true)
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId)
    setIsDeleting(false)
    if (err) { setError(err.message); return }
    setShowDeleteConfirm(false)
    onTaskDeleted?.(taskId)
    onClose()
  }


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface shadow-lg sm:max-h-[85vh] sm:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="عنوان تسک"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-default transition-colors placeholder:text-muted focus:border-action/50 focus:outline-none" />
              ) : (
                <h2 className="text-sm font-semibold text-default sm:text-base">{task.title}</h2>
              )}
              {!isEditing && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status]}`}>
                  {STATUS_LABEL[task.status]}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
                  {PRIORITY_LABEL[task.priority]}
                </span>
                {task.deadline && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-action/10 px-2 py-0.5 text-xs font-medium text-action">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatToPersianDate(task.deadline)}
                  </span>
                )}
                {task.xp_value > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {task.xp_value} XP
                  </span>
                )}
                {(() => {
                  const next = NEXT_STATUS[task.status]
                  if (!next) return null
                  const canAct = canEdit || (profile.role === 'member' && task.status !== 'review')
                  if (!canAct) return null
                  return (
                    <button onClick={handleMoveStatus}
                      className="inline-flex items-center gap-1 rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-medium text-action transition-colors hover:bg-action/20">
                      انتقال به {STATUS_LABEL[next]}
                    </button>
                  )
                })()}
              </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {canEdit && !isEditing && (
                <button onClick={startEditing}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}
              {canEdit && (
                <button onClick={handleDeleteTask}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-danger/60 transition-colors hover:bg-danger-subtle hover:text-danger">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default">✕</button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:space-y-6 sm:p-5">
          {isEditing && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-muted">توضیحات تسک</h4>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="توضیحات تسک..."
                  rows={3}
                  className="block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors placeholder:text-muted focus:border-action/50 focus:bg-surface focus:outline-none" />
              </div>

              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-muted">میزان XP</h4>
                <input type="number" min={0} value={editXpValue} onChange={(e) => setEditXpValue(Math.max(0, Number(e.target.value)))}
                  className="block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors focus:border-action/50 focus:bg-surface focus:outline-none" />
              </div>

              <PersianDatePicker
                label="ددلاین (تقویم شمسی)"
                value={editDeadline}
                onChange={setEditDeadline}
                placeholder="انتخاب موعد تحویل..."
              />

              <div>
                <h4 className="mb-1.5 text-xs font-semibold text-muted">سطح فوریت</h4>
                <div className="flex gap-2">
                  {(['normal', 'important', 'urgent'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setEditPriority(p)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${editPriority === p ? `${PRIORITY_BADGE[p]} border-current` : 'border-border text-muted hover:bg-surface-2'}`}>
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={memberDropdownRef}>
                <h4 className="mb-1.5 text-xs font-semibold text-muted">مسئولین</h4>
                {editAssigneeIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {allMembers.filter((m) => editAssigneeIds.includes(m.id)).map((m) => (
                      <span key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-action-subtle px-2.5 py-1 text-xs font-medium text-action">
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white bg-gradient-to-br ${m.role === 'admin' ? 'from-violet-500 to-purple-600' : 'from-emerald-500 to-teal-600'}`}>{m.full_name.charAt(0)}</span>
                        {m.full_name}
                        <button type="button" onClick={() => setEditAssigneeIds((prev) => prev.filter((id) => id !== m.id))}
                          className="text-action/60 transition-colors hover:text-danger" aria-label="حذف">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input value={memberSearch} onChange={(e) => { setMemberSearch(e.target.value); setMemberDropdownOpen(true) }}
                    onFocus={() => setMemberDropdownOpen(true)}
                    placeholder="جستجوی اعضا برای افزودن مسئول..."
                    className="block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors placeholder:text-muted focus:border-action/50 focus:bg-surface focus:outline-none" />
                  {memberDropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface-2 shadow-lg">
                      {allMembers.filter((m) => !editAssigneeIds.includes(m.id) && m.full_name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted">عضوی یافت نشد.</p>
                      ) : (
                        allMembers.filter((m) => !editAssigneeIds.includes(m.id) && m.full_name.toLowerCase().includes(memberSearch.toLowerCase())).map((m) => (
                          <button key={m.id} type="button" onClick={() => setEditAssigneeIds((prev) => [...prev, m.id])}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-default transition-colors hover:bg-surface">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white bg-gradient-to-br ${m.role === 'admin' ? 'from-violet-500 to-purple-600' : 'from-emerald-500 to-teal-600'}`}>{m.full_name.charAt(0)}</span>
                            {m.full_name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-action-hover disabled:opacity-50">
                  {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-default">
                  انصراف
                </button>
                {error && <span className="text-xs text-danger">{error}</span>}
              </div>
            </div>
          )}

          {!isEditing && task.description && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-muted">توضیحات</h4>
              <p className="text-sm text-default whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}

          {assignees.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted">مسئولین (برای مشاهده کارنامه کلیک کنید)</h4>
              <div className="flex flex-wrap gap-1.5">
                {assignees.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedMemberProfileId(a.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-action-subtle px-2.5 py-1 text-xs font-medium text-action transition-all hover:bg-action/20 active:scale-95 cursor-pointer"
                    title={`مشاهده کارنامه و تسک‌های انجام‌شده ${a.full_name}`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-action text-[9px] font-bold text-white">
                      {a.full_name.charAt(0)}
                    </span>
                    <span>{a.full_name}</span>
                  </button>
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
                        <label key={item.id} className={`flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors ${canToggle ? 'cursor-pointer hover:bg-surface-2' : ''}`}>
                          <input type="checkbox" checked={item.is_done}
                            onChange={() => canToggle && toggleChecklistItem(item)}
                            disabled={!canToggle}
                            className="h-4 w-4 rounded text-action focus:ring-action/30 disabled:opacity-40" />
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
                <div key={report.id} className="rounded-lg bg-surface-2 p-3.5">
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
                  className="block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors placeholder:text-muted focus:border-action/50 focus:bg-surface focus:outline-none" />
                {error && <div className="mt-1.5 text-sm text-danger">{error}</div>}
                <button type="submit" disabled={!reportContent.trim()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
                  ثبت گزارش
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-3 mx-auto">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-default text-center mb-2">حذف تسک</h3>
            <p className="text-xs text-muted text-center mb-5 leading-relaxed">
              {task?.xp_awarded && (task?.xp_value ?? 0) > 0
                ? `آیا از حذف این تسک اطمینان دارید؟ با حذف این تسک تکمیل‌شده، ${task.xp_value} امتیاز از اعضای منتسب به آن کسر خواهد شد.`
                : 'آیا از حذف این تسک اطمینان دارید؟ این عملیات قابل بازگشت نیست.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteTask}
                className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'در حال حذف...' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      <MemberProfileModal
        userId={selectedMemberProfileId}
        isOpen={!!selectedMemberProfileId}
        onClose={() => setSelectedMemberProfileId(null)}
        currentProfile={profile}
      />
    </div>
  )
}

