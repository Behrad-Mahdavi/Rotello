'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Project, Profile } from '@/utils/database.types'

interface TaskSummary {
  id: string
  project_id: string
  status: string
}

export default function ProjectsListPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const [profRes, projRes, tasksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, project_id, status'),
      ])

      if (profRes.data) setProfile(profRes.data)
      if (projRes.data) setProjects(projRes.data)
      if (tasksRes.data) setTasks(tasksRes.data)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  // Map task stats by project id
  const projectStats = useMemo(() => {
    const map: Record<string, { total: number; done: number; pct: number }> = {}
    for (const t of tasks) {
      if (!map[t.project_id]) map[t.project_id] = { total: 0, done: 0, pct: 0 }
      map[t.project_id].total++
      if (t.status === 'done') map[t.project_id].done++
    }
    for (const pid in map) {
      const { total, done } = map[pid]
      map[pid].pct = total > 0 ? Math.round((done / total) * 100) : 0
    }
    return map
  }, [tasks])

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase().trim()
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    )
  }, [projects, searchQuery])

  // Helper for deadline status
  function getDeadlineInfo(deadlineStr: string | null) {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)
    
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const formatted = deadline.toLocaleDateString('fa-IR')

    if (diffDays < 0) {
      return { label: 'مهلت تمام شده', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', formatted }
    } else if (diffDays === 0) {
      return { label: 'امروز آخرین مهلت', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', formatted }
    } else if (diffDays <= 3) {
      return { label: `${diffDays} روز تا موعد`, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', formatted }
    }
    return { label: `${diffDays} روز باقی‌مانده`, color: 'bg-surface-2 text-muted border-border', formatted }
  }

  const gradients = [
    { bar: 'from-emerald-500 to-teal-500', fill: 'bg-emerald-500', badge: 'from-emerald-500 to-teal-600' },
    { bar: 'from-indigo-500 to-violet-600', fill: 'bg-indigo-500', badge: 'from-indigo-500 to-violet-600' },
    { bar: 'from-amber-500 to-orange-500', fill: 'bg-amber-500', badge: 'from-amber-500 to-orange-600' },
    { bar: 'from-rose-500 to-pink-600', fill: 'bg-rose-500', badge: 'from-rose-500 to-pink-600' },
    { bar: 'from-teal-500 to-cyan-600', fill: 'bg-teal-500', badge: 'from-teal-500 to-cyan-600' },
    { bar: 'from-purple-500 to-fuchsia-600', fill: 'bg-purple-500', badge: 'from-purple-500 to-fuchsia-600' },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center text-sm text-muted">در حال بارگذاری پروژه‌ها...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-default">پروژه‌ها</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted">
              {projects.length} پروژه فعال در تیم • برای ورود به بورد کانبان روی پروژه کلیک کنید
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            {projects.length > 2 && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی پروژه..."
                  className="w-48 sm:w-60 rounded-xl border border-border bg-surface px-3 py-2 pr-9 text-xs transition-all focus:border-emerald-500/50 focus:outline-none"
                />
                <svg
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-2 text-xs text-muted hover:text-default"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Admin Add Project Button */}
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/projects')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95 shadow-sm cursor-pointer shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>پروژه جدید</span>
              </button>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, i) => {
            const g = gradients[i % gradients.length]
            const stats = projectStats[project.id] || { total: 0, done: 0, pct: 0 }
            const deadline = getDeadlineInfo(project.deadline)

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}/board`)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-0 text-right shadow-sm transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer"
                title={`ورود به بورد پروژه ${project.name}`}
              >
                {/* Top Accent Gradient Bar */}
                <div className={`h-2 w-full bg-gradient-to-r ${g.bar}`} />

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header with Initial & Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g.badge} text-white text-lg font-black shadow-md transition-transform duration-200 group-hover:scale-105`}
                      >
                        {project.name.charAt(0)}
                      </span>

                      {deadline && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${deadline.color}`}>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{deadline.label}</span>
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-base font-bold text-default group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {project.name}
                    </h2>

                    {/* Description */}
                    <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed min-h-[2rem]">
                      {project.description || 'بدون توضیحات ثبت‌شده برای این پروژه.'}
                    </p>
                  </div>

                  {/* Stats & Progress Section */}
                  <div className="mt-5 pt-4 border-t border-border/70 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">
                        {stats.total > 0 ? `${stats.done} از ${stats.total} تسک تکمیل شده` : 'بدون تسک'}
                      </span>
                      <span className="font-bold text-default">
                        {stats.pct}٪
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${g.bar} transition-all duration-500`}
                        style={{ width: `${stats.pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-5 py-3 text-xs font-semibold text-muted group-hover:text-emerald-400 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>مشاهده بورد کانبان</span>
                  </div>
                  <span className="text-base transition-transform duration-200 group-hover:-translate-x-1">
                    ←
                  </span>
                </div>
              </div>
            )
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
              {searchQuery ? 'هیچ پروژه‌ای مطابق با جستجوی شما یافت نشد.' : 'هنوز هیچ پروژه‌ای تعریف نشده است.'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
