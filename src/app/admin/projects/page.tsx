'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
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

  async function handleDeleteProject(id: string) {
    if (!confirm('آیا از حذف این پروژه اطمینان دارید؟')) return
    await supabase.from('projects').delete().eq('id', id)
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
                <div>
                  <label className="block text-xs font-medium text-muted">ددلاین</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none [color-scheme:dark]" />
                </div>
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
              <div key={project.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface pt-0 shadow-sm transition-all hover:shadow-md">
                <div className={`h-1.5 w-full bg-gradient-to-r ${g}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${g} text-white text-base font-bold`}>
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-default">{project.name}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted sm:text-sm">
                    {project.description || 'بدون توضیحات'}
                  </p>
                  {project.deadline && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{new Date(project.deadline).toLocaleDateString('fa-IR')}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <button onClick={() => router.push(`/projects/${project.id}/board`)}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white">
                      بورد
                    </button>
                    <button onClick={() => handleDeleteProject(project.id)}
                      className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-600 hover:text-white">
                      حذف
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
    </div>
  )
}
