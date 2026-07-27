'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Task, Profile, TaskPriority } from '@/utils/database.types'

interface CreateTaskModalProps {
  projectId: string
  onClose: () => void
  onTaskCreated: (task: Task) => void
}

interface CL { title: string; items: string[] }

export default function CreateTaskModal({ projectId, onClose, onTaskCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [xpValue, setXpValue] = useState(0)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [members, setMembers] = useState<Profile[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [checklists, setChecklists] = useState<CL[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'member').order('full_name')
      if (data) setMembers(data)
    }
    load()
  }, [])

  const addCL = () => setChecklists([...checklists, { title: '', items: [''] }])
  const rmCL = (i: number) => setChecklists(checklists.filter((_, idx) => idx !== i))
  const updCL = (i: number, v: string) => { const c = [...checklists]; c[i] = { ...c[i], title: v }; setChecklists(c) }
  const addItem = (ci: number) => { const c = [...checklists]; c[ci].items.push(''); setChecklists(c) }
  const updItem = (ci: number, ii: number, v: string) => { const c = [...checklists]; c[ci].items[ii] = v; setChecklists(c) }
  const rmItem = (ci: number, ii: number) => { const c = [...checklists]; c[ci].items = c[ci].items.filter((_, idx) => idx !== ii); setChecklists(c) }
  const toggle = (id: string) => setSelectedMembers((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    if (selectedMembers.length === 0) { setError('حداقل یک مسئول انتخاب کنید'); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }
    const { data: task, error: err } = await supabase.from('tasks').insert({ project_id: projectId, title, description, priority, xp_value: xpValue, created_by: user.id, status: 'backlog' }).select().single()
    if (err) { setError(err.message); setLoading(false); return }

    await supabase.from('task_assignees').insert(selectedMembers.map((uid) => ({ task_id: task.id, user_id: uid })))

    for (const cl of checklists) {
      if (!cl.title.trim()) continue
      const { data: ch } = await supabase.from('checklists').insert({ task_id: task.id, title: cl.title }).select().single()
      if (!ch) continue
      const items = cl.items.filter((x) => x.trim()).map((content, idx) => ({ checklist_id: ch.id, content, sort_order: idx }))
      if (items.length) await supabase.from('checklist_items').insert(items)
    }

    onTaskCreated(task)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface shadow-lg sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-default">تسک جدید</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default">✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5" dir="rtl">
          <div>
            <label className="block text-xs font-medium text-muted">عنوان تسک</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors placeholder:text-muted focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">توضیحات</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors placeholder:text-muted focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">مقدار XP</label>
            <input type="number" value={xpValue} onChange={(e) => setXpValue(Number(e.target.value))} min={0} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">اولویت</label>
            <div className="flex gap-1.5">
              {(['normal', 'important', 'urgent'] as TaskPriority[]).map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    priority === p
                      ? p === 'urgent' ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40' :
                        p === 'important' ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40' :
                        'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                      : 'border border-border bg-surface-2 text-subtle hover:bg-surface'
                  }`}>
                  {p === 'normal' ? 'عادی' : p === 'important' ? 'مهم' : 'فوری'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">مسئولین</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    selectedMembers.includes(m.id)
                      ? 'bg-action text-white shadow-sm' 
                      : 'border border-border bg-surface-2 text-subtle hover:bg-surface'
                  }`}>
                  {m.full_name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-muted">چک‌لیست‌ها</label>
              <button type="button" onClick={addCL} className="text-xs font-medium text-action hover:text-action-hover">+ افزودن چک‌لیست</button>
            </div>
            {checklists.map((cl, ci) => (
              <div key={ci} className="mb-2 rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <input type="text" value={cl.title} onChange={(e) => updCL(ci, e.target.value)} placeholder="عنوان چک‌لیست"
                    className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-xs focus:border-action/50 focus:outline-none" />
                  <button type="button" onClick={() => rmCL(ci)} className="text-danger/60 hover:text-danger text-xs">حذف</button>
                </div>
                {cl.items.map((item, ii) => (
                  <div key={ii} className="mt-1.5 flex items-center gap-2">
                    <input type="text" value={item} onChange={(e) => updItem(ci, ii, e.target.value)} placeholder="آیتم"
                      className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-xs focus:border-action/50 focus:outline-none" />
                    <button type="button" onClick={() => rmItem(ci, ii)} className="text-muted hover:text-danger text-xs">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => addItem(ci)} className="mt-1.5 text-xs text-action hover:text-action-hover">+ آیتم</button>
              </div>
            ))}
          </div>

          {error && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
            {loading ? 'در حال ساخت...' : 'ساخت تسک'}
          </button>
        </form>
      </div>
    </div>
  )
}
