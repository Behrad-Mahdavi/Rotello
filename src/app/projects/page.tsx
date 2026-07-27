'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Project, Profile } from '@/utils/database.types'

export default function ProjectsListPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (data) setProjects(data); setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-default">پروژه‌ها</h2>
          <p className="text-sm text-muted">پروژه مورد نظر را انتخاب کنید</p>
        </div>

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
              <button key={project.id} onClick={() => router.push(`/projects/${project.id}/board`)}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface pt-0 text-right shadow-sm transition-all hover:shadow-md">
                <div className={`h-1.5 w-full bg-gradient-to-r ${g}`} />
                <div className="p-5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${g} text-white text-base font-bold shadow-sm`}>
                    {project.name.charAt(0)}
                  </span>
                  <h3 className="mt-3 font-semibold text-default">{project.name}</h3>
                  {project.description && <p className="mt-1 text-xs text-muted line-clamp-2 sm:text-sm">{project.description}</p>}
                </div>
              </button>
            )
          })}
          {projects.length === 0 && (
            <div className="col-span-full rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">هنوز پروژه‌ای وجود ندارد.</div>
          )}
        </div>
      </main>
    </div>
  )
}
