'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile, Task } from '@/utils/database.types'

interface TaskWithProject extends Task {
  project_name: string
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'بک‌لاگ',
  todo: 'در صف انجام',
  in_progress: 'در حال انجام',
  review: 'در حال بازبینی',
  done: 'تکمیل‌شده',
}

const STATUS_STYLE: Record<string, string> = {
  backlog: 'bg-gray-500/10 text-gray-400',
  todo: 'bg-slate-500/10 text-slate-400',
  in_progress: 'bg-emerald-500/10 text-emerald-400',
  review: 'bg-amber-500/10 text-amber-400',
  done: 'bg-teal-500/10 text-teal-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
}

const PRIORITY_STYLE: Record<string, string> = {
  normal: 'bg-sky-500/10 text-sky-400',
  important: 'bg-orange-500/10 text-orange-400',
  urgent: 'bg-rose-500/10 text-rose-400',
}

export default function MyTasksPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: assignData } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id)

      if (assignData && assignData.length > 0) {
        const taskIds = assignData.map((a: { task_id: string }) => a.task_id)

        const { data: fullTasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', taskIds)
          .order('created_at', { ascending: false })

        if (fullTasks) {
          const taskList = fullTasks as Task[]
          const projectIds = [...new Set(taskList.map((t) => t.project_id))] as string[]

          const { data: projects } = await supabase
            .from('projects')
            .select('id, name')
            .in('id', projectIds)

          const projectMap = new Map<string, string>(projects?.map((p: { id: string; name: string }) => [p.id, p.name]) || [])

          const enriched = taskList.map((t) => ({
            ...t,
            project_name: projectMap.get(t.project_id) || 'پروژه ناشناخته',
          }))
          setTasks(enriched)
        }
      }

      setLoading(false)
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
          <h2 className="text-lg font-bold text-default">تسک‌های من</h2>
          <p className="text-sm text-muted">{tasks.length} تسک محول‌شده</p>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center text-sm text-muted">
            هیچ تسکی به شما محول نشده است.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/projects/${t.project_id}/board`)}
                className="group w-full rounded-xl border border-border bg-surface p-4 text-right shadow-sm transition-all hover:border-border-strong hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-default group-hover:text-action transition-colors line-clamp-1">
                      {t.title}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-muted">پروژه:</span>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-action">
                        {t.project_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                    {t.deadline && (
                      <span className="flex items-center gap-1 rounded-full bg-action/10 px-2 py-0.5 text-[11px] font-medium text-action">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(t.deadline).toLocaleDateString('fa-IR')}
                      </span>
                    )}
                    {t.xp_value > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        {t.xp_value}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
