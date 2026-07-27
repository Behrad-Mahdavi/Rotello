'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { Project } from '@/utils/database.types'

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
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
    const { error: err } = await supabase.from('projects').insert({ name, description: description || null, created_by: user.id })
    if (err) { setError(err.message); setLoading(false); return }
    setName(''); setDescription(''); setShowForm(false)
    await reload()
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('آیا از حذف این پروژه اطمینان دارید؟')) return
    await supabase.from('projects').delete().eq('id', id)
    await reload()
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-default">پروژه‌ها</h1>
          <p className="text-sm text-subtle">{projects.length} پروژه</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-admin px-4 py-2 text-sm font-medium text-white transition-all hover:bg-admin-hover shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? 'لغو' : 'پروژه جدید'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-surface p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-default">پروژه جدید</h3>
          <form onSubmit={handleCreateProject} className="space-y-3" dir="rtl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-subtle">نام پروژه</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm transition-all focus:bg-surface focus:outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-subtle">توضیحات</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm transition-all focus:bg-surface focus:outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
            </div>
            {error && <div className="rounded-xl bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" disabled={loading}
              className="rounded-xl bg-admin px-4 py-2 text-sm font-medium text-white transition-all hover:bg-admin-hover disabled:opacity-50 shadow-sm">
              {loading ? 'در حال ساخت...' : 'ساخت پروژه'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-3">
        {projects.map((project) => (
          <div key={project.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-default truncate">{project.name}</h3>
              {project.description && <p className="mt-0.5 text-sm text-subtle line-clamp-1">{project.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/projects/${project.id}/board`)}
                className="flex-1 sm:flex-none rounded-xl bg-admin-subtle px-3.5 py-2 text-xs font-medium text-admin transition-colors hover:bg-admin hover:text-white text-center">
                ورود به بورد
              </button>
              <button onClick={() => handleDeleteProject(project.id)}
                className="rounded-xl bg-danger-subtle px-3.5 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger hover:text-white">
                حذف
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && <div className="py-16 text-center text-sm text-muted">هیچ پروژه‌ای وجود ندارد.</div>}
      </div>
    </div>
  )
}
