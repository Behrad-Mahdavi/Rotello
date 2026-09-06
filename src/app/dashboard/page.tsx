'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import MemberProfileModal from '@/components/MemberProfileModal'
import type { Profile, Task, Project } from '@/utils/database.types'

interface DashData {
  profile: Profile | null
  projects: number
  activeProjects: number
  totalTasks: number
  doneTasks: number
  members: number
  completionRate: number
  tasksByStatus: { label: string; value: number; color: string }[]
  projectsProgress: { name: string; color: string; total: number; done: number }[]
  recentTasks: Task[]
  topUsers: { id: string; name: string; xp: number; initial: string }[]
}


const STATUS_LABELS: Record<string, string> = {
  backlog: 'بک‌لاگ',
  todo: 'در صف انجام',
  in_progress: 'در حال انجام',
  done: 'تکمیل‌شده',
}

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  todo: '#94a3b8',
  in_progress: '#10b981',
  done: '#14b8a6',
}

const PROJECT_GRADIENTS = [
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-red-600',
]

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()


  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const [profRes, projectsRes, tasksRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('profiles').select('*'),
      ])

      const prof = profRes.data
      if (!prof || prof.role !== 'admin') { router.push('/projects'); return }

      const projects: Project[] = projectsRes.data || []
      const tasks: Task[] = tasksRes.data || []
      const members: Profile[] = membersRes.data || []

      const pList = projects
      const tList = tasks
      const mList = members
      const doneTasks = tList.filter((t) => t.status === 'done').length
      const activeProjects = pList.filter(() => true).length

      const tasksByStatus = ['backlog', 'todo', 'in_progress', 'done'].map((s) => ({
        label: STATUS_LABELS[s],
        value: tList.filter((t) => t.status === s).length,
        color: STATUS_COLORS[s],
      }))

      const projectsProgress = pList.map((p, i) => {
        const pt = tList.filter((t) => t.project_id === p.id)
        return {
          name: p.name,
          color: `hsl(${i * 60}, 70%, 50%)`,
          total: pt.length,
          done: pt.filter((t) => t.status === 'done').length,
        }
      })

      const recentTasks = [...tList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

      const topUsers = [...mList]
        .filter((m) => m.role !== 'admin')
        .sort((a, b) => b.xp_total - a.xp_total)
        .slice(0, 5)
        .map((m) => ({ id: m.id, name: m.full_name, xp: m.xp_total, initial: m.full_name.charAt(0) }))


      setData({
        profile: prof,
        projects: pList.length,
        activeProjects,
        totalTasks: tList.length,
        doneTasks,
        members: mList.filter((m) => m.role !== 'admin').length,
        completionRate: tList.length > 0 ? Math.round((doneTasks / tList.length) * 100) : 0,
        tasksByStatus,
        projectsProgress,
        recentTasks,
        topUsers,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )

  if (!data) return null

  const totalTaskPct = data.totalTasks > 0 ? Math.round((data.doneTasks / data.totalTasks) * 100) : 0

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={data.profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-default">داشبورد</h2>
              <p className="text-sm text-muted">نمای کلی از وضعیت پروژه‌ها و کارها</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'پروژه‌ها', value: data.projects, hint: `${data.activeProjects} پروژه فعال`, icon: '📁', bg: 'bg-emerald-500' },
              { title: 'کل کارها', value: data.totalTasks, hint: `${data.doneTasks} کار تکمیل‌شده`, icon: '📋', bg: 'bg-violet-500' },
              { title: 'درصد تکمیل', value: `${data.completionRate}٪`, hint: 'نسبت کارهای انجام‌شده', icon: '📈', bg: 'bg-teal-500' },
              { title: 'اعضای تیم', value: data.members, hint: 'افراد حاضر در تیم', icon: '👥', bg: 'bg-amber-500' },
            ].map((stat, i) => (
              <div key={i} className="group relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all hover:shadow-md">
                <div className={`absolute -left-6 -top-6 h-24 w-24 rounded-full ${stat.bg} opacity-20 blur-2xl`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted sm:text-sm">{stat.title}</p>
                      <p className="mt-1 text-2xl font-bold text-default sm:text-3xl">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted">{stat.hint}</p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg} text-lg text-white sm:h-11 sm:w-11`}>
                      {stat.icon}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-default">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                توزیع وضعیت کارها
              </h3>
              <p className="mt-1 text-xs text-muted">تقسیم کارها بر اساس وضعیت فعلی</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-40 w-40">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    {data.tasksByStatus.reduce((acc, item, i) => {
                      const pct = data.totalTasks > 0 ? (item.value / data.totalTasks) * 100 : 0
                      const prevPct = acc.reduce((s, x) => s + x, 0)
                      const startAngle = (prevPct / 100) * 360
                      const angle = (pct / 100) * 360
                      if (angle <= 0) return [...acc, 0]
                      const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                      const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                      const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180)
                      const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180)
                      const largeArc = angle > 180 ? 1 : 0
                      return [...acc, pct]
                    }, [] as number[]).length > 0 && (
                      <g>
                        {data.tasksByStatus.map((item, i) => {
                          const pct = data.totalTasks > 0 ? (item.value / data.totalTasks) * 100 : 0
                          const prevPct = data.tasksByStatus.slice(0, i).reduce((s, x) => s + (data.totalTasks > 0 ? (x.value / data.totalTasks) * 100 : 0), 0)
                          const startAngle = (prevPct / 100) * 360 - 90
                          const angle = (pct / 100) * 360
                          if (angle <= 0) return null
                          const endAngle = startAngle + angle
                          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                          const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                          const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                          const largeArc = angle > 180 ? 1 : 0
                          return (
                            <path key={i}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={item.color}
                            />
                          )
                        })}
                        <circle cx="50" cy="50" r="25" className="fill-surface" />
                      </g>
                    )}
                  </svg>
                </div>
                <div className="flex-1 space-y-2">
                  {data.tasksByStatus.map((s) => (
                    <div key={s.label} className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted">{s.label}</span>
                      </div>
                      <span className="font-semibold text-default">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-default">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                پیشرفت پروژه‌ها
              </h3>
              <p className="mt-1 text-xs text-muted">نسبت کارهای انجام‌شده در هر پروژه</p>
              <div className="mt-4 space-y-4">
                {data.projectsProgress.length === 0 && (
                  <p className="text-sm text-muted">هنوز پروژه‌ای وجود ندارد.</p>
                )}
                {data.projectsProgress.map((p, i) => {
                  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
                  return (
                    <div key={p.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2 font-medium text-default">
                          <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${PROJECT_GRADIENTS[i % PROJECT_GRADIENTS.length]}`} />
                          {p.name}
                        </div>
                        <span className="text-muted">
                          {p.done} از {p.total} ({pct}٪)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${PROJECT_GRADIENTS[i % PROJECT_GRADIENTS.length]} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-default">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                آخرین کارها
              </h3>
              <div className="mt-4 space-y-3">
                {data.recentTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-center text-xs font-medium ${
                      t.status === 'done' ? 'bg-teal-500/10 text-teal-400' :
                      t.status === 'in_progress' ? 'bg-emerald-500/10 text-emerald-400' :
                      t.status === 'todo' ? 'bg-slate-500/10 text-slate-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◐' : '○'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-default sm:text-sm">{t.title}</p>
                      <p className="text-[11px] text-muted">{STATUS_LABELS[t.status]}</p>
                    </div>
                  </div>
                ))}
                {data.recentTasks.length === 0 && (
                  <p className="text-sm text-muted">هنوز کاری وجود ندارد.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-default">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                برترین اعضا
              </h3>
              <p className="mt-1 text-xs text-muted">بر اساس امتیاز XP</p>
              <div className="mt-4 space-y-2">
                {data.topUsers.map((u, i) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedMemberId(u.id)}
                    className="flex items-center gap-3 p-1.5 rounded-xl cursor-pointer hover:bg-surface-2/70 transition-colors group"
                    title="کلیک برای مشاهده کارنامه و تسک‌های انجام‌شده"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-sm transition-transform group-hover:scale-105">
                      {u.initial}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-default sm:text-sm truncate group-hover:text-emerald-400 transition-colors">{u.name}</p>
                      <p className="text-[11px] text-muted">{i + 1}ام در بین اعضا</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-xp">
                      {u.xp} XP
                    </span>
                    <svg className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                ))}
                {data.topUsers.length === 0 && (
                  <p className="text-sm text-muted">هنوز عضوی وجود ندارد.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Member Profile Modal */}
      <MemberProfileModal
        userId={selectedMemberId}
        isOpen={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        currentProfile={data.profile}
      />
    </div>
  )
}

