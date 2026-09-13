'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import PersianDatePicker from './PersianDatePicker'
import UserAvatar from './UserAvatar'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { Task, Profile, TaskPriority } from '@/utils/database.types'
import {
  X,
  Check,
  Plus,
  Zap,
  Users,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react'

interface CreateTaskModalProps {
  projectId: string
  onClose: () => void
  onTaskCreated: (task: Task) => void
  onOpenMembersModal?: () => void
}

interface CL {
  title: string
  items: string[]
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

export default function CreateTaskModal({ projectId, onClose, onTaskCreated, onOpenMembersModal }: CreateTaskModalProps) {
  useBodyScrollLock(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [xpValue, setXpValue] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [members, setMembers] = useState<Profile[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [checklists, setChecklists] = useState<CL[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const filteredMembers = members.filter((m) =>
    (m.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    async function load() {
      setLoadingMembers(true)
      try {
        const res = await fetch(`/api/projects/${projectId}/members`)
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members || [])
        }
      } catch (err) {
        console.error('Error fetching project members:', err)
      } finally {
        setLoadingMembers(false)
      }
    }
    load()
  }, [projectId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showDropdown) {
          setShowDropdown(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showDropdown])

  const addCL = () => setChecklists([...checklists, { title: '', items: [''] }])
  const rmCL = (i: number) => setChecklists(checklists.filter((_, idx) => idx !== i))
  const updCL = (i: number, v: string) => {
    const c = [...checklists]
    c[i] = { ...c[i], title: v }
    setChecklists(c)
  }
  const addItem = (ci: number) => {
    const c = [...checklists]
    c[ci].items.push('')
    setChecklists(c)
  }
  const updItem = (ci: number, ii: number, v: string) => {
    const c = [...checklists]
    c[ci].items[ii] = v
    setChecklists(c)
  }
  const rmItem = (ci: number, ii: number) => {
    const c = [...checklists]
    c[ci].items = c[ci].items.filter((_, idx) => idx !== ii)
    setChecklists(c)
  }
  const toggleMember = (id: string) =>
    setSelectedMembers((p) => (p.includes(id) ? p.filter((m) => m !== id) : [...p, id]))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('عنوان تسک الزامی است.')
      return
    }
    if (selectedMembers.length === 0) {
      setError('حداقل یک مسئول برای تسک انتخاب کنید.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('عدم احراز هویت. لطفاً مجدداً وارد شوید.')
      setLoading(false)
      return
    }

    const { data: task, error: err } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
        priority,
        xp_value: Math.max(0, Number(xpValue) || 0),
        created_by: user.id,
        status: 'backlog',
      })
      .select()
      .single()

    if (err) {
      setError(err.message || 'خطا در ثبت تسک')
      setLoading(false)
      return
    }

    // Insert assignees
    await supabase
      .from('task_assignees')
      .insert(selectedMembers.map((uid) => ({ task_id: task.id, user_id: uid })))

    // Insert checklists
    for (const cl of checklists) {
      if (!cl.title.trim()) continue
      const { data: ch } = await supabase
        .from('checklists')
        .insert({ task_id: task.id, title: cl.title.trim() })
        .select()
        .single()
      if (!ch) continue
      const validItems = cl.items.filter((x) => x.trim()).map((content, idx) => ({
        checklist_id: ch.id,
        content: content.trim(),
        sort_order: idx,
      }))
      if (validItems.length > 0) {
        await supabase.from('checklist_items').insert(validItems)
      }
    }

    onTaskCreated(task)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border-[1.5px] border-border bg-surface shadow-[4px_4px_0_#202A5A] dark:shadow-[4px_4px_0_#59BBAF] flex flex-col text-right animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border-strong/60 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/15 text-action border border-action/30 shadow-xs">
              <Plus className="w-5 h-5 text-action" />
            </div>
            <div>
              <h2 className="text-base font-black text-default">تعریف تسک جدید</h2>
              <p className="text-xs text-muted font-medium mt-0.5">مشخصات، مسئولین، امتیاز و چک‌لیست تسک</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-2 hover:text-default transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs font-bold text-rose-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              عنوان تسک <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="عنوان تسک را وارد کنید..."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-semibold text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              توضیحات و نیازمندی‌های تسک
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="شرح جزئیات، راهنمای انجام، یا استانداردهای مورد انتظار..."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-medium text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none resize-none"
            />
          </div>

          {/* XP & Deadline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-default mb-1.5 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                <span>امتیاز تسک (XP) <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="number"
                min={0}
                value={xpValue}
                onChange={(e) => setXpValue(Number(e.target.value))}
                required
                className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm font-bold text-default focus:border-action focus:bg-surface focus:outline-none"
              />
            </div>

            <div>
              <PersianDatePicker
                label="موعد تحویل (ددلاین)"
                value={deadline}
                onChange={setDeadline}
                placeholder="انتخاب تاریخ موعد..."
              />
            </div>
          </div>

          {/* Priority Segmented Control */}
          <div>
            <label className="block text-xs font-bold text-default mb-1.5">سطح فوریت</label>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'important', 'urgent'] as TaskPriority[]).map((p) => {
                const isSelected = priority === p
                const conf = PRIORITY_CONFIG[p]
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
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

          {/* Project Member Assignees Multi-Picker */}
          <div ref={searchRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-default flex items-center gap-1.5">
                <Users className="h-4 w-4 text-action" />
                <span>مسئولین تسک <span className="text-rose-500">*</span></span>
              </label>
              <span className="text-[11px] text-muted">
                {members.length} عضو در پروژه
              </span>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 p-3 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-action" />
                <span>در حال دریافت اعضای پروژه...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>هیچ عضوی در این پروژه ثبت نشده است.</span>
                </p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  تسک‌های هر پروژه فقط به اعضای همان پروژه اختصاص می‌یابند. ابتدا اعضای پروژه را مشخص کنید.
                </p>
                {onOpenMembersModal && (
                  <button
                    type="button"
                    onClick={onOpenMembersModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-xs"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>افزودن اعضا به این پروژه</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Selected members chips */}
                {selectedMembers.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedMembers.map((uid) => {
                      const m = members.find((mm) => mm.id === uid)
                      if (!m) return null
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-action/30 bg-action/10 px-2.5 py-1 text-xs font-semibold text-action"
                        >
                          <UserAvatar src={m.avatar_url} name={m.full_name} role={m.role} size="xs" shape="circle" />
                          <span>{m.full_name}</span>
                          <button
                            type="button"
                            onClick={() => toggleMember(uid)}
                            className="text-action/70 hover:text-rose-500 cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="جستجو و انتخاب مسئول از بین اعضای پروژه..."
                  className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-xs font-medium text-default placeholder:text-muted focus:border-action focus:bg-surface focus:outline-none"
                />

                {showDropdown && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl py-1">
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        عضوی با این نام در پروژه یافت نشد.
                      </div>
                    ) : (
                      filteredMembers.map((m) => {
                        const isSelected = selectedMembers.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              toggleMember(m.id)
                              setSearchQuery('')
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                              isSelected ? 'bg-action/10 text-action font-bold' : 'text-default hover:bg-surface-2'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar src={m.avatar_url} name={m.full_name} role={m.role} size="sm" shape="circle" />
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-default">{m.full_name}</div>
                                <div className="text-[10px] text-muted truncate">
                                  {m.role === 'admin' ? 'راهبر' : m.role === 'mentor' ? 'منتور' : 'عضو باشگاه'}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-action shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Checklists Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-default flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-action" />
                <span>چک‌لیست‌های تسک (اختیاری)</span>
              </label>
              <button
                type="button"
                onClick={addCL}
                className="text-xs font-bold text-action hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>افزودن چک‌لیست</span>
              </button>
            </div>

            {checklists.map((cl, ci) => (
              <div key={ci} className="rounded-2xl border border-border/80 bg-surface-2/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cl.title}
                    onChange={(e) => updCL(ci, e.target.value)}
                    placeholder="عنوان چک‌لیست (مثلا: مراحل تست یا تحویل)..."
                    className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold focus:border-action focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => rmCL(ci)}
                    className="p-1.5 text-muted hover:text-rose-500 rounded-lg transition cursor-pointer"
                    title="حذف این چک‌لیست"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 pr-2 border-r-2 border-border/60">
                  {cl.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted/40 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updItem(ci, ii, e.target.value)}
                        placeholder="آیتم چک‌لیست..."
                        className="flex-1 rounded-lg border border-border/70 bg-surface px-2.5 py-1.5 text-xs focus:border-action focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => rmItem(ci, ii)}
                        className="p-1 text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(ci)}
                    className="text-[11px] font-bold text-action hover:underline pt-1 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>افزودن آیتم جدید</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-2.5 pt-4 border-t border-border mt-5">
            <button
              type="submit"
              disabled={loading}
              className="rokad-btn-primary flex-1 py-2.5 text-xs sm:text-sm font-bold justify-center disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ایجاد تسک...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>ایجاد و ثبت تسک</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-muted hover:text-default transition cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
