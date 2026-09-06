'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import PersianDatePicker from '@/components/PersianDatePicker'
import { formatToPersianDate } from '@/utils/jalaali'
import type { Project, Profile } from '@/utils/database.types'

export default function AdminProjectsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/projects'); return }
      setProfile(prof)
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (data) setProjects(data); setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (data) setProjects(data)
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }
    const { error: err } = await supabase.from('projects').insert({ name, description: description || null, deadline: deadline || null, created_by: user.id })
    if (err) { setError(err.message); setLoading(false); return }
    setName(''); setDescription(''); setDeadline(''); setShowForm(false)
    await reload()
  }

  async function confirmDeleteProject() {
    if (!projectToDelete) return
    setIsDeleting(true)
    await supabase.from('projects').delete().eq('id', projectToDelete.id)
    setIsDeleting(false)
    setProjectToDelete(null)
    await reload()
  }

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )
  if (!profile) return null

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-default">پروژه‌ها</h2>
            <p className="text-sm text-muted">{projects.length} پروژه</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 shadow-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'لغو' : 'پروژه جدید'}
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-default">پروژه جدید</h3>
            <form onSubmit={handleCreateProject} className="space-y-3" dir="rtl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted">نام پروژه</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">توضیحات</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none" />
                </div>
                <PersianDatePicker
                  label="ددلاین (تقویم شمسی)"
                  value={deadline}
                  onChange={setDeadline}
                  placeholder="انتخاب تاریخ موعد تحویل..."
                />
              </div>
              {error && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
              <button type="submit" disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
                {loading ? 'در حال ساخت...' : 'ساخت پروژه'}
              </button>
            </form>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => {
            const gradients = [
              'from-emerald-500 to-teal-600',
              'from-rose-500 to-pink-600',
              'from-amber-500 to-orange-600',
              'from-violet-500 to-purple-600',
              'from-teal-500 to-cyan-600',
              'from-orange-500 to-red-600',
            ]
            const g = gradients[i % gradients.length]
            return (
              <div key={project.id} className="group relative overflow-hidden rounded-2xl border border-border bg-surface pt-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-border-subtle">
                <div className={`h-2 w-full bg-gradient-to-r ${g}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${g} text-white text-base font-bold shadow-sm`}>
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-default text-sm sm:text-base">{project.name}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted sm:text-sm leading-relaxed">
                    {project.description || 'بدون توضیحات'}
                  </p>
                  {project.deadline && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatToPersianDate(project.deadline)}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <button onClick={() => router.push(`/projects/${project.id}/board`)}
                      className="rounded-xl bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer active:scale-95 shadow-sm">
                      مشاهده بورد ←
                    </button>
                    <button onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                      className="rounded-xl bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-600 hover:text-white cursor-pointer active:scale-95">
                      حذف پروژه
                    </button>
                  </div>
                </div>
              </div>

            )
          })}
          {projects.length === 0 && (
            <div className="col-span-full rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">هیچ پروژه‌ای وجود ندارد.</div>
          )}
        </div>
      </main>

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setProjectToDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-3 mx-auto">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-default text-center mb-2">حذف پروژه</h3>
            <p className="text-xs text-muted text-center mb-5 leading-relaxed">
              آیا از حذف پروژه <span className="font-semibold text-default">«{projectToDelete.name}»</span> اطمینان دارید؟ تمام تسک‌ها و اطلاعات مربوط به این پروژه حذف خواهند شد.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteProject}
                className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? 'در حال حذف...' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
