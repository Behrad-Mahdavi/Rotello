'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

import MemberProfileModal from './MemberProfileModal'
import PersianDatePicker from './PersianDatePicker'
import UserAvatar from './UserAvatar'
import { formatToPersianDate } from '@/utils/jalaali'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { Task, Profile, Checklist, ChecklistItem, TaskReport, TaskPriority, TaskStatus } from '@/utils/database.types'
import {
  X,
  Pencil,
  Trash2,
  Zap,
  Calendar,
  Users,
  CheckSquare,
  MessageSquare,
  Send,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CircleDot,
  Archive,
  Check,
  Loader2,
  FileText,
  Sparkles,
} from 'lucide-react'

interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
  profile: Profile
  onTaskDeleted?: (taskId: string) => void
  onTaskUpdated?: (task: Task) => void
}

type WithItems = Checklist & { items: ChecklistItem[] }
type WithAuthor = TaskReport & { author: { full_name: string; avatar_url?: string | null; role?: string } }

const STATUS_CONFIG: Record<TaskStatus, { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  backlog: {
    label: 'بک‌لاگ',
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-400/30',
    icon: Archive,
  },
  todo: {
    label: 'در صف انجام',
    bg: 'bg-[#202A5A]/10 dark:bg-blue-500/20',
    text: 'text-[#202A5A] dark:text-blue-400',
    border: 'border-[#202A5A]/30 dark:border-blue-500/40',
    icon: CircleDot,
  },
  in_progress: {
    label: 'در حال انجام',
    bg: 'bg-[#4DA59A]/15 dark:bg-[#59BBAF]/20',
    text: 'text-[#2E7A71] dark:text-[#59BBAF]',
    border: 'border-[#59BBAF]/40',
    icon: Clock,
  },
  review: {
    label: 'در حال بازبینی',
    bg: 'bg-[#F8A41D]/15 dark:bg-[#F8A41D]/20',
    text: 'text-[#B45309] dark:text-[#fde047]',
    border: 'border-[#F8A41D]/40',
    icon: Clock,
  },
  done: {
    label: 'تکمیل‌شده',
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/40',
    icon: CheckCircle2,
  },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; bg: string; text: string; border: string }> = {
  normal: {
    label: 'عادی',
    bg: 'bg-[#202A5A]/10 text-[#202A5A] dark:bg-blue-500/15 dark:text-blue-300',
    text: 'text-[#202A5A] dark:text-blue-300',
    border: 'border-[#202A5A]/20 dark:border-blue-500/30',
  },
  important: {
    label: 'مهم',
    bg: 'bg-[#FEF6E8] text-[#B45309] dark:bg-[#57390A]/40 dark:text-amber-300',
    text: 'text-[#B45309] dark:text-amber-300',
    border: 'border-[#F8A41D]/40',
  },
  urgent: {
    label: 'فوری',
    bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/40',
  },
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  backlog: 'todo',
  todo: 'in_progress',
  in_progress: 'review',
  review: 'done',
  done: null,
}

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
  const [editPriority, setEditPriority] = useState<TaskPriority>('normal')
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([])
  const [allMembers, setAllMembers] = useState<Profile[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [movingStatus, setMovingStatus] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const memberDropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [tRes, clsRes, rptsRes, aaRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('checklists').select('*, items:checklist_items(*)').eq('task_id', taskId).order('sort_order'),
        supabase.from('task_reports').select('*, author:profiles(full_name, avatar_url, role)').eq('task_id', taskId).order('created_at', { ascending: true }),
        supabase.from('task_assignees').select('user_id, profile:profiles(*)').eq('task_id', taskId),
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

      if (t?.project_id) {
        try {
          const mRes = await fetch(`/api/projects/${t.project_id}/members`)
          if (mRes.ok) {
            const mData = await mRes.json()
            const projectMembers: Profile[] = mData.members || []
            setAllMembers(projectMembers)
            if (aa) {
              const userIds = aa.map((a: { user_id: string }) => a.user_id)
              const memberMap = new Map<string, Profile>(projectMembers.map((m) => [m.id, m]))
              setAssignees(userIds.map((uid: string) => memberMap.get(uid) || { id: uid, full_name: 'کاربر', role: 'member', xp_total: 0, created_at: '' }))
            }
          }
        } catch (e) {
          console.error('Error fetching project members for task detail:', e)
        }
      }
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedMemberProfileId) {
          setSelectedMemberProfileId(null)
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        } else if (memberDropdownOpen) {
          setMemberDropdownOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedMemberProfileId, showDeleteConfirm, memberDropdownOpen])

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

    const updated: Task = {
      ...task,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      xp_value: editXpValue,
      deadline: editDeadline || null,
      priority: editPriority,
    }
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
    if (!reportContent.trim() || submittingReport) return
    setSubmittingReport(true)
    const { data, error: err } = await supabase.from('task_reports').insert({
      task_id: taskId,
      author_id: profile.id,
      content: reportContent.trim(),
    }).select('*, author:profiles(full_name, avatar_url, role)').single()

    setSubmittingReport(false)
    if (err) { setError(err.message); return }
    setReports((prev) => [...prev, data as unknown as WithAuthor])
    setReportContent('')
  }

  const canEdit = profile.role === 'admin'

  async function handleMoveStatus() {
    if (!task || movingStatus) return
    const next = NEXT_STATUS[task.status]
    if (!next) return
    setMovingStatus(true)
    const { error: err } = await supabase.rpc('move_task_status', { p_task_id: taskId, p_new_status: next })
    setMovingStatus(false)
    if (err) { setError(err.message); return }
    const updated = { ...task, status: next as TaskStatus }
    setTask(updated)
    onTaskUpdated?.(updated)
    setError('')
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

  // Checklist total metrics
  const checklistStats = useMemo(() => {
    let total = 0
    let done = 0
    for (const cl of checklists) {
      for (const item of cl.items) {
        total++
        if (item.is_done) done++
      }
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, pct }
  }, [checklists])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-8 shadow-xl">
          <Loader2 className="h-7 w-7 animate-spin text-action" />
          <span className="text-xs font-bold text-muted">در حال بارگذاری تسک...</span>
        </div>
      </div>
    )
  }

  if (!task) return null

  const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog
  const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal
  const nextStatus = NEXT_STATUS[task.status]
  const canMoveStatus = canEdit || (profile.role === 'member' && task.status !== 'review')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border-[1.5px] border-border bg-surface shadow-[4px_4px_0_#202A5A] dark:shadow-[4px_4px_0_#59BBAF] flex flex-col text-right animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border-strong/60 sm:hidden" />

        {/* Modal Header */}
        <div className="border-b border-border/80 bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">عنوان تسک <span className="text-rose-500">*</span></label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="عنوان تسک..."
                    className="w-full rounded-xl border border-border bg-surface-2/70 px-3.5 py-2 text-sm sm:text-base font-bold text-default transition-all placeholder:text-muted focus:border-action focus:bg-surface focus:outline-none"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                      <statusConf.icon className="h-3.5 w-3.5" />
                      <span>{statusConf.label}</span>
                    </span>
                    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${priorityConf.bg} ${priorityConf.border}`}>
                      {priorityConf.label}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-default leading-snug break-words pt-0.5">
                    {task.title}
                  </h2>
                </div>
              )}
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {canEdit && !isEditing && (
                <button
                  onClick={startEditing}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-default hover:border-action/40 cursor-pointer shadow-2xs"
                  title="ویرایش مشخصات تسک"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {canEdit && !isEditing && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-rose-500 transition-colors hover:bg-rose-500/10 hover:border-rose-500/40 cursor-pointer shadow-2xs"
                  title="حذف تسک"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-default cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Meta Info Ribbon (View Mode Only) */}
          {!isEditing && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                {/* XP Badge */}
                <div className="inline-flex items-center gap-1 rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 border border-[#F8A41D]/35 px-2.5 py-1 text-xs font-black text-[#BA7B16] dark:text-[#fde047] shadow-2xs">
                  <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                  <span>{(task.xp_value || 0).toLocaleString('fa-IR')} XP</span>
                </div>

                {/* Deadline Badge */}
                {task.deadline && (
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface-2/60 px-2.5 py-1 text-xs font-semibold text-muted shadow-2xs">
                    <Calendar className="h-3.5 w-3.5 text-muted" />
                    <span>مهلت: {formatToPersianDate(task.deadline)}</span>
                  </div>
                )}
              </div>

              {/* Status Transition Action Button */}
              {nextStatus && canMoveStatus && (
                <button
                  onClick={handleMoveStatus}
                  disabled={movingStatus}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-action-hover active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {movingStatus ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>انتقال به {STATUS_CONFIG[nextStatus].label}</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2.5 text-xs font-bold text-rose-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* EDIT MODE FORM */}
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-default mb-1.5">توضیحات تسک</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="شرح جزئیات، نیازمندی‌ها و نکات اجرایی تسک..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-medium text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none resize-none"
                />
              </div>

              {/* Two columns: XP and Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-default mb-1.5 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                    <span>میزان امتیاز (XP)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editXpValue}
                    onChange={(e) => setEditXpValue(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm font-bold text-default focus:border-action focus:bg-surface focus:outline-none"
                  />
                </div>

                <div>
                  <PersianDatePicker
                    label="مهلت انجام (تقویم شمسی)"
                    value={editDeadline}
                    onChange={setEditDeadline}
                    placeholder="انتخاب موعد تحویل..."
                  />
                </div>
              </div>

              {/* Priority Segmented Control */}
              <div>
                <label className="block text-xs font-bold text-default mb-1.5">سطح فوریت</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'important', 'urgent'] as const).map((p) => {
                    const isSelected = editPriority === p
                    const conf = PRIORITY_CONFIG[p]
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditPriority(p)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? `${conf.bg} ${conf.border} ring-2 ring-offset-1 ring-action/40 shadow-xs font-black`
                            : 'border-border bg-surface-2/50 text-muted hover:text-default hover:bg-surface-2'
                        }`}
                      >
                        {p === 'urgent' && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                        {p === 'important' && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                        <span>{conf.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Member Assignees Multi-Picker */}
              <div ref={memberDropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-default flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-action" />
                    <span>مسئولین تسک</span>
                  </label>
                  <span className="text-[11px] text-muted">{allMembers.length} عضو در پروژه</span>
                </div>

                {/* Selected assignees pills */}
                {editAssigneeIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {allMembers.filter((m) => editAssigneeIds.includes(m.id)).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-action/30 bg-action/10 px-2.5 py-1 text-xs font-semibold text-action"
                      >
                        <UserAvatar src={m.avatar_url} name={m.full_name} role={m.role} size="xs" shape="circle" />
                        <span>{m.full_name}</span>
                        <button
                          type="button"
                          onClick={() => setEditAssigneeIds((prev) => prev.filter((id) => id !== m.id))}
                          className="text-action/70 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberDropdownOpen(true) }}
                    onFocus={() => setMemberDropdownOpen(true)}
                    placeholder="جستجو و انتخاب مسئول از بین اعضای پروژه..."
                    className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-xs font-medium text-default placeholder:text-muted focus:border-action focus:bg-surface focus:outline-none"
                  />
                  {memberDropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl py-1">
                      {allMembers.filter((m) => !editAssigneeIds.includes(m.id) && m.full_name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                        <p className="px-3 py-2.5 text-center text-xs text-muted">کاربری برای افزودن یافت نشد.</p>
                      ) : (
                        allMembers.filter((m) => !editAssigneeIds.includes(m.id) && m.full_name.toLowerCase().includes(memberSearch.toLowerCase())).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditAssigneeIds((prev) => [...prev, m.id])}
                            className="flex w-full items-center justify-between px-3 py-2 text-xs text-default hover:bg-surface-2 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar src={m.avatar_url} name={m.full_name} role={m.role} size="sm" shape="circle" />
                              <span className="font-semibold">{m.full_name}</span>
                            </div>
                            <span className="text-[10px] text-action font-bold">+ افزودن</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Form Actions */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-border/80">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rokad-btn-primary flex-1 py-2.5 text-xs sm:text-sm font-bold justify-center disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-muted hover:text-default transition cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            /* VIEW MODE DETAILS */
            <>
              {/* Description Section */}
              <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-default">
                  <FileText className="h-4 w-4 text-action" />
                  <span>توضیحات تسک</span>
                </div>
                <p className="text-xs sm:text-sm text-default/90 whitespace-pre-wrap leading-relaxed">
                  {task.description || 'بدون توضیحات ثبت‌شده برای این تسک.'}
                </p>
              </div>

              {/* Assignees Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-default">
                    <Users className="h-4 w-4 text-action" />
                    <span>مسئولین انجام تسک</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.2 text-[10px] font-bold text-muted border border-border">
                      {assignees.length.toLocaleString('fa-IR')} نفر
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-muted">کلیک برای مشاهده کارنامه</span>
                </div>

                {assignees.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 p-3 text-center text-xs text-muted">
                    مسئولی برای این تسک تعیین نشده است.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {assignees.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedMemberProfileId(a.id)}
                        className="group flex items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-2.5 transition-all hover:border-action/40 hover:bg-surface-2 hover:shadow-2xs active:scale-[0.99] cursor-pointer text-right"
                        title={`مشاهده کارنامه ${a.full_name}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            src={a.avatar_url}
                            name={a.full_name}
                            role={a.role}
                            size="sm"
                            shape="circle"
                            className="ring-1 ring-border shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-default group-hover:text-action transition-colors truncate">
                              {a.full_name}
                            </div>
                            <div className="text-[10px] text-muted truncate">
                              {a.role === 'admin' ? 'راهبر' : a.role === 'mentor' ? 'منتور' : 'عضو باشگاه'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-action opacity-0 group-hover:opacity-100 transition-opacity">
                          مشاهده ←
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklists Section */}
              {checklists.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-default">
                      <CheckSquare className="h-4 w-4 text-action" />
                      <span>چک‌لیست‌ها</span>
                    </div>
                    {checklistStats.total > 0 && (
                      <span className="text-[11px] font-bold text-muted">
                        {checklistStats.done.toLocaleString('fa-IR')} از {checklistStats.total.toLocaleString('fa-IR')} مورد ({checklistStats.pct}٪)
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {checklistStats.total > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 border border-border/60">
                      <div
                        className="h-full bg-action transition-all duration-300 rounded-full"
                        style={{ width: `${checklistStats.pct}%` }}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {checklists.map((cl) => (
                      <div key={cl.id} className="rounded-2xl border border-border/80 bg-surface p-3 sm:p-3.5 space-y-2 shadow-2xs">
                        <h5 className="text-xs sm:text-sm font-bold text-default">{cl.title}</h5>
                        <div className="space-y-1.5">
                          {cl.items.map((item) => {
                            const canToggle = canEdit || isAssignee
                            return (
                              <label
                                key={item.id}
                                className={`flex items-center gap-2.5 rounded-xl border border-border/60 p-2 text-xs sm:text-sm transition-all select-none ${
                                  canToggle ? 'cursor-pointer hover:bg-surface-2' : 'opacity-80'
                                } ${item.is_done ? 'bg-surface-2/40' : 'bg-surface'}`}
                              >
                                <div
                                  className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                    item.is_done ? 'bg-action border-action text-white' : 'border-border bg-surface-2/60'
                                  }`}
                                >
                                  {item.is_done && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={item.is_done}
                                  onChange={() => canToggle && toggleChecklistItem(item)}
                                  disabled={!canToggle}
                                  className="sr-only"
                                />
                                <span className={`flex-1 min-w-0 ${item.is_done ? 'line-through text-muted' : 'text-default font-medium'}`}>
                                  {item.content}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reports & Activity Stream Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-default">
                    <MessageSquare className="h-4 w-4 text-action" />
                    <span>گزارش‌ها و بازخوردها</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.2 text-[10px] font-bold text-muted border border-border">
                      {reports.length.toLocaleString('fa-IR')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto overscroll-contain pr-0.5">
                  {reports.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-surface-2/20 p-5 text-center text-xs text-muted">
                      هنوز گزارشی برای این تسک ثبت نشده است.
                    </div>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="rounded-2xl border border-border/70 bg-surface-2/40 p-3 sm:p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={report.author?.avatar_url}
                              name={report.author?.full_name || 'کاربر'}
                              role={report.author?.role as any}
                              size="xs"
                              shape="circle"
                            />
                            <span className="font-bold text-default text-xs">{report.author?.full_name || 'کاربر'}</span>
                          </div>
                          <span className="text-[10px] text-muted">{new Date(report.created_at).toLocaleDateString('fa-IR')}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-default/90 whitespace-pre-wrap leading-relaxed pr-6">
                          {report.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Report Form */}
                {(isAssignee || canEdit) && (
                  <form onSubmit={handleAddReport} className="pt-2">
                    <div className="rounded-2xl border border-border bg-surface p-2.5 focus-within:border-action/80 transition-colors shadow-2xs">
                      <textarea
                        value={reportContent}
                        onChange={(e) => setReportContent(e.target.value)}
                        placeholder="افزودن گزارش پیشرفت یا ثبت نظر..."
                        rows={2}
                        className="w-full bg-transparent px-1 text-xs sm:text-sm text-default placeholder:text-muted focus:outline-none resize-none"
                      />
                      <div className="flex items-center justify-end pt-2 border-t border-border/60">
                        <button
                          type="submit"
                          disabled={!reportContent.trim() || submittingReport}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-action-hover disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                          {submittingReport ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>ارسال گزارش</span>
                              <Send className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-[1.5px] border-border bg-surface p-6 shadow-[4px_4px_0_#E0195B] text-right animate-in zoom-in-95 duration-150"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-3 mx-auto border border-rose-500/20 shadow-xs">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-default text-center mb-2">حذف تسک</h3>
            <p className="text-xs text-muted text-center mb-5 leading-relaxed">
              {task?.xp_awarded && (task?.xp_value ?? 0) > 0
                ? `آیا از حذف این تسک اطمینان دارید؟ با حذف این تسک تکمیل‌شده، ${(task.xp_value).toLocaleString('fa-IR')} امتیاز از اعضای منتسب به آن کسر خواهد شد.`
                : 'آیا از حذف این تسک اطمینان دارید؟ این عملیات قابل بازگشت نیست.'}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteTask}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {isDeleting ? 'در حال حذف...' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs font-bold text-default hover:bg-surface transition-colors cursor-pointer"
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
        isAdmin={profile?.role === 'admin'}
      />
    </div>
  )
}
