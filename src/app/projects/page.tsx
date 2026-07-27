'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import type { Project, Profile } from '@/utils/database.types'

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (data) setProjects(data); setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted">...</div>

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface shadow-sm overflow-hidden">
              <Image src="/logog.png" alt="رکاد" width={24} height={24} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-default">رکاد</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/profile')}
              className="flex items-center gap-1.5 rounded-xl bg-action-subtle px-2.5 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action hover:text-on-dark sm:gap-2 sm:px-3">
              <span className="hidden sm:inline">{profile?.full_name}</span>
              <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xp">{profile?.xp_total} XP</span>
            </button>
            <LogoutButton minimal />
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-default">پروژه‌ها</h1>
            <p className="text-sm text-subtle">پروژه مورد نظر را انتخاب کنید</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <button key={project.id} onClick={() => router.push(`/projects/${project.id}/board`)}
                className="group rounded-2xl bg-surface p-5 text-right shadow-sm transition-all hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-action to-action-hover text-base font-bold text-on-dark shadow-sm">
                  {project.name.charAt(0)}
                </div>
                <h3 className="font-semibold text-default">{project.name}</h3>
                {project.description && <p className="mt-1 text-sm text-subtle line-clamp-2">{project.description}</p>}
              </button>
            ))}
            {projects.length === 0 && <div className="col-span-full py-16 text-center text-sm text-muted">هنوز پروژه‌ای وجود ندارد.</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
