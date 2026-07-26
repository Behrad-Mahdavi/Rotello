'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Task, Profile } from '@/utils/database.types'

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
    const { data: task, error: err } = await supabase.from('tasks').insert({ project_id: projectId, title, description, xp_value: xpValue, created_by: user.id, status: 'backlog' }).select().single()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-5 py-4">
          <h2 className="text-sm font-bold text-default">تسک جدید</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-default">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" dir="rtl">
          <div>
            <label className="block text-xs font-medium text-subtle">عنوان تسک</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              className="mt-1.5 block w-full rounded-xl bg-canvas px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-subtle">توضیحات</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
              className="mt-1.5 block w-full rounded-xl bg-canvas px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-subtle">مقدار XP</label>
              <input type="number" value={xpValue} onChange={(e) => setXpValue(Number(e.target.value))} min={0} required
                className="mt-1.5 block w-full rounded-xl bg-canvas px-3.5 py-2.5 text-sm transition-colors focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-subtle mb-2">مسئولین</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedMembers.includes(m.id)
                      ? 'bg-action text-on-dark shadow-sm' 
                      : 'bg-canvas text-subtle hover:bg-border'
                  }`}>
                  {m.full_name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-subtle">چک‌لیست‌ها</label>
              <button type="button" onClick={addCL} className="text-xs font-medium text-action hover:text-action-hover">+ افزودن چک‌لیست</button>
            </div>
            {checklists.map((cl, ci) => (
              <div key={ci} className="mb-2 rounded-xl bg-canvas p-3">
                <div className="flex items-center gap-2">
                  <input type="text" value={cl.title} onChange={(e) => updCL(ci, e.target.value)} placeholder="عنوان چک‌لیست"
                    className="flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-action/20" />
                  <button type="button" onClick={() => rmCL(ci)} className="text-danger/60 hover:text-danger text-xs">حذف</button>
                </div>
                {cl.items.map((item, ii) => (
                  <div key={ii} className="mt-1.5 flex items-center gap-2">
                    <input type="text" value={item} onChange={(e) => updItem(ci, ii, e.target.value)} placeholder="آیتم"
                      className="flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-action/20" />
                    <button type="button" onClick={() => rmItem(ci, ii)} className="text-muted hover:text-danger text-xs">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => addItem(ci)} className="mt-1.5 text-xs text-action hover:text-action-hover">+ آیتم</button>
              </div>
            ))}
          </div>

          {error && <div className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-action px-4 py-2.5 text-sm font-medium text-on-dark transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
            {loading ? 'در حال ساخت...' : 'ساخت تسک'}
          </button>
        </form>
      </div>
    </div>
  )
}
