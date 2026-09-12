'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import MemberProfileModal from '@/components/MemberProfileModal'
import { DEPARTMENTS, type DepartmentKey } from '@/constants/departments'
import type { Profile, Task, Project } from '@/utils/database.types'
import {
  Crown,
  Medal,
  Plus,
  Users,
  Trophy,
  FolderKanban,
  ClipboardList,
  Zap,
  Building2,
  CheckCircle2,
  Clock,
  CircleDot,
  Archive,
  AlertTriangle,
  ChevronLeft,
  Calendar,
  Sparkles,
  PieChart,
  Activity,
} from 'lucide-react'

interface DashData {
  profile: Profile
  projects: Project[]
  tasks: Task[]
  members: Profile[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  done: { label: 'تکمیل‌شده', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', dot: '#10b981' },
  in_progress: { label: 'در حال انجام', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', dot: '#3b82f6' },
  todo: { label: 'در صف انجام', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', dot: '#f59e0b' },
  backlog: { label: 'بک‌لاگ', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/25', dot: '#94a3b8' },
}

const PROJECT_COLOR_PALETTES = [
  { gradient: 'from-violet-500 to-indigo-600', text: 'text-violet-500 dark:text-violet-400', dot: '#8b5cf6' },
  { gradient: 'from-cyan-500 to-blue-600', text: 'text-cyan-500 dark:text-cyan-400', dot: '#06b6d4' },
  { gradient: 'from-amber-500 to-orange-600', text: 'text-amber-500 dark:text-amber-400', dot: '#f59e0b' },
  { gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-500 dark:text-emerald-400', dot: '#10b981' },
  { gradient: 'from-rose-500 to-pink-600', text: 'text-rose-500 dark:text-rose-400', dot: '#f43f5e' },
  { gradient: 'from-fuchsia-500 to-purple-600', text: 'text-fuchsia-500 dark:text-fuchsia-400', dot: '#d946ef' },
]

function getProjectColor(project: Project, index: number) {
  if (project.department === 'engineers') {
    return { gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-500 dark:text-emerald-400', dot: '#10b981' }
  }
  if (project.department === 'artists') {
    return { gradient: 'from-purple-500 to-pink-600', text: 'text-purple-500 dark:text-purple-400', dot: '#a855f7' }
  }
  if (project.department === 'generalists') {
    return { gradient: 'from-amber-500 to-orange-600', text: 'text-amber-500 dark:text-amber-400', dot: '#f59e0b' }
  }
  return PROJECT_COLOR_PALETTES[index % PROJECT_COLOR_PALETTES.length]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const [profRes, projectsRes, tasksRes, membersFetch] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        fetch('/api/members').then((r) => (r.ok ? r.json() : { members: [] })),
      ])

      const userRole = (user.user_metadata?.role || profRes.data?.role || 'member')
      const userDeps = profRes.data?.departments || (user.user_metadata?.departments || [])

      const prof = profRes.data
        ? {
            ...profRes.data,
            role: userRole,
            departments: userDeps,
            avatar_url: profRes.data.avatar_url || user.user_metadata?.avatar_url || null,
          }
        : null

      if (!prof || prof.role !== 'admin') {
        router.push('/projects')
        return
      }

      setData({
        profile: prof,
        projects: projectsRes.data || [],
        tasks: tasksRes.data || [],
        members: membersFetch.members || [],
      })
      setLoading(false)
    }
    load()
  }, [router, supabase])

  // Computed Metrics
  const metrics = useMemo(() => {
    if (!data) return null
    const { projects, tasks, members } = data

    const regularMembers = members.filter((m) => m.role === 'member')
    const mentors = members.filter((m) => m.role === 'mentor')
    const admins = members.filter((m) => m.role === 'admin')

    const doneTasks = tasks.filter((t) => t.status === 'done').length
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length
    const todoTasks = tasks.filter((t) => t.status === 'todo').length
    const backlogTasks = tasks.filter((t) => t.status === 'backlog').length
    const completionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

    const totalXp = regularMembers.reduce((sum, m) => sum + (m.xp_total || 0), 0)
    const avgXp = regularMembers.length > 0 ? Math.round(totalXp / regularMembers.length) : 0

    // Department Stats
    const deptStats: Record<DepartmentKey, { membersCount: number; levelACount: number; levelBCount: number; projectsCount: number }> = {
      engineers: { membersCount: 0, levelACount: 0, levelBCount: 0, projectsCount: 0 },
      artists: { membersCount: 0, levelACount: 0, levelBCount: 0, projectsCount: 0 },
      generalists: { membersCount: 0, levelACount: 0, levelBCount: 0, projectsCount: 0 },
    }

    regularMembers.forEach((m) => {
      if (m.departments && Array.isArray(m.departments)) {
        m.departments.forEach((d) => {
          if (deptStats[d.department]) {
            deptStats[d.department].membersCount++
            if (d.level === 'A') deptStats[d.department].levelACount++
            if (d.level === 'B') deptStats[d.department].levelBCount++
          }
        })
      }
    })

    projects.forEach((p) => {
      if (p.department && deptStats[p.department as DepartmentKey]) {
        deptStats[p.department as DepartmentKey].projectsCount++
      }
    })

    const topPerformers = [...regularMembers].slice(0, 5)
    const urgentTasks = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done')

    return {
      totalProjects: projects.length,
      totalTasks: tasks.length,
      doneTasks,
      inProgressTasks,
      todoTasks,
      backlogTasks,
      completionRate,
      regularMembersCount: regularMembers.length,
      mentorsCount: mentors.length,
      adminsCount: admins.length,
      totalXp,
      avgXp,
      deptStats,
      topPerformers,
      urgentTasks,
    }
  }, [data])

  // Donut chart segments calculation for task status breakdown
  const donutSegments = useMemo(() => {
    if (!metrics || metrics.totalTasks === 0) return []
    const total = metrics.totalTasks
    const radius = 60
    const circumference = 2 * Math.PI * radius
    let accumulatedOffset = 0

    const statuses = [
      { key: 'done', count: metrics.doneTasks, color: '#10b981' },
      { key: 'in_progress', count: metrics.inProgressTasks, color: '#3b82f6' },
      { key: 'todo', count: metrics.todoTasks, color: '#f59e0b' },
      { key: 'backlog', count: metrics.backlogTasks, color: '#94a3b8' },
    ]

    return statuses.map((item) => {
      const length = (item.count / total) * circumference
      const offset = accumulatedOffset
      accumulatedOffset += length
      return {
        ...item,
        length,
        offset,
        circumference,
      }
    })
  }, [metrics])

  // Sorted projects by completion percentage descending (Request 1)
  const sortedProjects = useMemo(() => {
    if (!data) return []
    return [...data.projects]
      .map((p, pIdx) => {
        const projTasks = data.tasks.filter((t) => t.project_id === p.id)
        const projDone = projTasks.filter((t) => t.status === 'done').length
        const pct = projTasks.length > 0 ? Math.round((projDone / projTasks.length) * 100) : 0
        const totalXp = projTasks.reduce((sum, t) => sum + (t.xp_value || 0), 0)
        return {
          ...p,
          pIdx,
          projTasks,
          projDone,
          pct,
          totalXp,
        }
      })
      .sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct
        return b.projTasks.length - a.projTasks.length
      })
  }, [data])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 space-y-6 animate-pulse">
          <div className="h-24 w-full rounded-2xl bg-surface-2/70 border border-border" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-surface-2/70 border border-border" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-surface-2/70 border border-border" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="h-72 rounded-2xl bg-surface-2/70 border border-border lg:col-span-5" />
            <div className="h-72 rounded-2xl bg-surface-2/70 border border-border lg:col-span-7" />
          </div>
        </main>
      </div>
    )
  }

  if (!data || !metrics) return null

  return (
    <div className="flex min-h-screen flex-col bg-canvas transition-colors duration-200" dir="rtl">
      <AppHeader profile={data.profile} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* 1. Welcome & Executive Banner */}
        <div className="relative overflow-hidden rounded-2xl border-[1.5px] border-border bg-surface p-4 sm:p-6 shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-all">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#59BBAF]/10 blur-3xl pointer-events-none" />
          <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-[#652D90]/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3.5 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0EAF4] dark:bg-[#231032] border border-[#652D90]/30 px-3 py-0.5 text-xs font-black text-[#652D90] dark:text-[#c084fc]">
                  <Crown className="h-3.5 w-3.5" />
                  <span>پنل راهبری باشگاه</span>
                </span>
                <span className="text-xs text-muted">|</span>
                <span className="text-xs font-bold text-muted">باشگاه کسب‌وکار رکاد</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-default tracking-tight flex items-center gap-2">
                <span>سلام، {data.profile.full_name} عزیز</span>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </h1>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <Link
                href="/admin/projects"
                className="rokad-btn-primary px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Plus className="h-4 w-4" />
                <span>پروژه جدید</span>
              </Link>

              <Link
                href="/admin/members"
                className="rokad-btn-outline px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Users className="h-4 w-4" />
                <span>مدیریت اعضا</span>
              </Link>

              <Link
                href="/leaderboard"
                className="cursor-pointer select-none inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#F8A41D] bg-[#FEF6E8] dark:bg-[#57390A]/40 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#BA7B16] dark:text-[#fde047] shadow-[2px_2px_0_#BA7B16] hover:shadow-[2.5px_2.5px_0_#BA7B16] hover:-translate-y-0.5 active:translate-y-0.5 transition-all min-h-[38px] col-span-2 sm:col-span-1"
              >
                <Trophy className="h-4 w-4" />
                <span>لیدربورد باشگاه</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Four Master Metric Cards (Rokad Persona Tokens) */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Ecosystem Token: Projects */}
          <div className="group relative overflow-hidden rounded-2xl border-[1.5px] border-[#59BBAF]/60 bg-surface p-3.5 sm:p-5 shadow-[2.5px_2.5px_0_#59BBAF] transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black text-[#59BBAF]">اکوسیستم پروژه‌ها</span>
                <h3 className="mt-1 text-xl sm:text-3xl font-black text-default">
                  {metrics.totalProjects.toLocaleString('fa-IR')}
                </h3>
                <p className="mt-0.5 text-xs text-muted font-medium">
                  کل پروژه‌های تعریف‌شده
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-ecosystem-light dark:bg-[#1F413D]/60 text-[#59BBAF] border border-[#59BBAF]/40 shadow-xs">
                <FolderKanban className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between text-xs font-bold">
              <span className="text-muted">نرخ انجام کل:</span>
              <span className="font-black text-[#59BBAF]">{metrics.completionRate}٪</span>
            </div>
          </div>

          {/* 2. Club Token: Tasks */}
          <div className="group relative overflow-hidden rounded-2xl border-[1.5px] border-[#652D90]/50 dark:border-[#8A38F5]/50 bg-surface p-3.5 sm:p-5 shadow-[2.5px_2.5px_0_#652D90] dark:shadow-[2.5px_2.5px_0_#8A38F5] transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black text-[#652D90] dark:text-[#c084fc]">عملیات و تسک‌ها</span>
                <h3 className="mt-1 text-xl sm:text-3xl font-black text-default">
                  {metrics.totalTasks.toLocaleString('fa-IR')}
                </h3>
                <p className="mt-0.5 text-xs text-muted font-medium">
                  <span className="font-bold text-emerald-500">{metrics.doneTasks.toLocaleString('fa-IR')}</span> کار انجام‌شده
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0EAF4] dark:bg-[#231032] text-[#652D90] dark:text-[#c084fc] border border-[#652D90]/30 shadow-xs">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between text-xs font-bold">
              <span className="text-muted">در حال انجام:</span>
              <span className="font-black text-blue-500">{metrics.inProgressTasks.toLocaleString('fa-IR')} تسک</span>
            </div>
          </div>

          {/* 3. College Token: XP and Rewards */}
          <div className="group relative overflow-hidden rounded-2xl border-[1.5px] border-[#F8A41D]/60 bg-surface p-3.5 sm:p-5 shadow-[2.5px_2.5px_0_#F8A41D] transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black text-[#F8A41D]">مجموع امتیازات (XP)</span>
                <h3 className="mt-1 text-xl sm:text-3xl font-black text-[#F8A41D]">
                  {metrics.totalXp.toLocaleString('fa-IR')}
                </h3>
                <p className="mt-0.5 text-xs text-muted font-medium">
                  میانگین {metrics.avgXp.toLocaleString('fa-IR')} برای هر عضو
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/60 text-[#F8A41D] border border-[#F8A41D]/40 shadow-xs">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between text-xs font-bold">
              <span className="text-muted">لیدربورد اعضا:</span>
              <span className="font-black text-[#F8A41D]">فعال و پویا</span>
            </div>
          </div>

          {/* 4. Male / Team Persona Token: Members */}
          <div className="group relative overflow-hidden rounded-2xl border-[1.5px] border-[#202A5A]/30 dark:border-[#59BBAF]/30 bg-surface p-3.5 sm:p-5 shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black text-muted">جامعه اعضای باشگاه</span>
                <h3 className="mt-1 text-xl sm:text-3xl font-black text-default">
                  {metrics.regularMembersCount.toLocaleString('fa-IR')}
                </h3>
                <p className="mt-0.5 text-xs text-muted font-medium">
                  {metrics.mentorsCount} منتور · {metrics.adminsCount} راهبر
                </p>
              </div>
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-default border border-border shadow-xs">
                <Users className="h-5 w-5 text-muted" />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between text-xs font-bold">
              <span className="text-muted">کل افراد ثبت‌شده:</span>
              <span className="font-black text-default">{data.members.length.toLocaleString('fa-IR')} نفر</span>
            </div>
          </div>
        </div>

        {/* 3. Department Health & Distribution (Engineers, Artists, Generalists) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-muted border border-border">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm sm:text-base font-black text-default">
                ترکیب و راندمان دپارتمان‌های تخصصی
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
            {/* Engineers */}
            <div className="rounded-2xl border-[1.5px] border-emerald-500/40 bg-surface p-3.5 sm:p-4 shadow-[2.5px_2.5px_0_#10b981] transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {DEPARTMENTS.engineers.label}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted border border-border">
                  {metrics.deptStats.engineers.projectsCount} پروژه
                </span>
              </div>
              <p className="text-xs text-muted font-medium leading-relaxed">{DEPARTMENTS.engineers.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-xl bg-surface-2/70 p-2 sm:p-2.5 text-center border border-border/70">
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">کل اعضا</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.engineers.membersCount}</div>
                </div>
                <div className="border-x border-border/80">
                  <div className="text-[11px] sm:text-xs text-emerald-500 font-black">سطح A</div>
                  <div className="text-sm sm:text-base font-black text-emerald-500 mt-0.5">{metrics.deptStats.engineers.levelACount}</div>
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">سطح B</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.engineers.levelBCount}</div>
                </div>
              </div>
            </div>

            {/* Artists */}
            <div className="rounded-2xl border-[1.5px] border-purple-500/40 bg-surface p-3.5 sm:p-4 shadow-[2.5px_2.5px_0_#a855f7] transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="rounded-xl bg-purple-500/15 border border-purple-500/30 px-3 py-0.5 text-xs font-black text-purple-600 dark:text-purple-300">
                  {DEPARTMENTS.artists.label}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted border border-border">
                  {metrics.deptStats.artists.projectsCount} پروژه
                </span>
              </div>
              <p className="text-xs text-muted font-medium leading-relaxed">{DEPARTMENTS.artists.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-xl bg-surface-2/70 p-2 sm:p-2.5 text-center border border-border/70">
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">کل اعضا</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.artists.membersCount}</div>
                </div>
                <div className="border-x border-border/80">
                  <div className="text-[11px] sm:text-xs text-purple-500 font-black">سطح A</div>
                  <div className="text-sm sm:text-base font-black text-purple-500 mt-0.5">{metrics.deptStats.artists.levelACount}</div>
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">سطح B</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.artists.levelBCount}</div>
                </div>
              </div>
            </div>

            {/* Generalists */}
            <div className="rounded-2xl border-[1.5px] border-amber-500/40 bg-surface p-3.5 sm:p-4 shadow-[2.5px_2.5px_0_#f59e0b] transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-xs font-black text-amber-600 dark:text-amber-400">
                  {DEPARTMENTS.generalists.label}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted border border-border">
                  {metrics.deptStats.generalists.projectsCount} پروژه
                </span>
              </div>
              <p className="text-xs text-muted font-medium leading-relaxed">{DEPARTMENTS.generalists.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-xl bg-surface-2/70 p-2 sm:p-2.5 text-center border border-border/70">
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">کل اعضا</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.generalists.membersCount}</div>
                </div>
                <div className="border-x border-border/80">
                  <div className="text-[11px] sm:text-xs text-amber-500 font-black">سطح A</div>
                  <div className="text-sm sm:text-base font-black text-amber-500 mt-0.5">{metrics.deptStats.generalists.levelACount}</div>
                </div>
                <div>
                  <div className="text-[11px] sm:text-xs text-muted font-bold">سطح B</div>
                  <div className="text-sm sm:text-base font-black text-default mt-0.5">{metrics.deptStats.generalists.levelBCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Operations & Velocity (Task Breakdown + Project Health) */}
        <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-12 items-stretch">
          {/* Task Status Breakdown (6 cols) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border-[1.5px] border-border bg-surface p-3.5 sm:p-6 shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-all">
            {/* Header: Clean title + total tasks count */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-[#59BBAF] border border-border/80">
                  <PieChart className="h-4 w-4" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-default">
                  توزیع وضعیت کارها
                </h3>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted border border-border">
                {metrics.totalTasks.toLocaleString('fa-IR')} تسک
              </span>
            </div>

            {/* Middle: Balanced Side-by-side Donut & Metrics */}
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-6 py-2">
              {/* Circular Donut */}
              <div className="relative flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 shrink-0">
                <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-surface-2"
                  />
                  {donutSegments.map((seg) => {
                    if (seg.count === 0) return null
                    return (
                      <circle
                        key={seg.key}
                        cx="80"
                        cy="80"
                        r="60"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={`${seg.length} ${seg.circumference - seg.length}`}
                        strokeDashoffset={-seg.offset}
                        className="transition-all duration-700 ease-out"
                      />
                    )
                  })}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                  <span className="text-2xl sm:text-3xl font-black text-default leading-none tracking-tight">
                    {metrics.completionRate}٪
                  </span>
                  <span className="mt-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {metrics.doneTasks.toLocaleString('fa-IR')} از {metrics.totalTasks.toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>

              {/* 4 Status Rows with mini progress bars */}
              <div className="w-full flex-1 space-y-2">
                {/* 1. Done */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 transition-all hover:bg-emerald-500/10">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>تکمیل‌شده</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-default text-xs">{metrics.doneTasks.toLocaleString('fa-IR')}</span>
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {metrics.totalTasks > 0 ? Math.round((metrics.doneTasks / metrics.totalTasks) * 100) : 0}٪
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metrics.totalTasks > 0 ? (metrics.doneTasks / metrics.totalTasks) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* 2. In Progress */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 transition-all hover:bg-blue-500/10">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-black text-blue-600 dark:text-blue-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>در حال انجام</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-default text-xs">{metrics.inProgressTasks.toLocaleString('fa-IR')}</span>
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                        {metrics.totalTasks > 0 ? Math.round((metrics.inProgressTasks / metrics.totalTasks) * 100) : 0}٪
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${metrics.totalTasks > 0 ? (metrics.inProgressTasks / metrics.totalTasks) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* 3. Todo */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 transition-all hover:bg-amber-500/10">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400">
                      <CircleDot className="h-3.5 w-3.5" />
                      <span>در صف انجام</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-default text-xs">{metrics.todoTasks.toLocaleString('fa-IR')}</span>
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                        {metrics.totalTasks > 0 ? Math.round((metrics.todoTasks / metrics.totalTasks) * 100) : 0}٪
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${metrics.totalTasks > 0 ? (metrics.todoTasks / metrics.totalTasks) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* 4. Backlog */}
                <div className="rounded-xl border border-border/80 bg-surface-2/60 p-2.5 transition-all hover:bg-surface-2">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-black text-muted">
                      <Archive className="h-3.5 w-3.5" />
                      <span>بک‌لاگ</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-default text-xs">{metrics.backlogTasks.toLocaleString('fa-IR')}</span>
                      <span className="text-[10px] font-black text-muted">
                        {metrics.totalTasks > 0 ? Math.round((metrics.backlogTasks / metrics.totalTasks) * 100) : 0}٪
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-slate-400" style={{ width: `${metrics.totalTasks > 0 ? (metrics.backlogTasks / metrics.totalTasks) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status / Urgent Alert */}
            {metrics.urgentTasks.length > 0 ? (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{metrics.urgentTasks.length} تسک فوری ناتمام</span>
                </span>
                <Link href="/projects" className="underline font-black hover:text-rose-700 flex items-center gap-0.5 text-xs">
                  <span>مشاهده</span>
                  <ChevronLeft className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 flex items-center gap-2 text-xs text-muted font-medium">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>تمام کارهای ثبت‌شده در جریان منظم قرار دارند.</span>
              </div>
            )}
          </div>

          {/* Project Health & Progress (6 cols) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border-[1.5px] border-border bg-surface p-3.5 sm:p-6 shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-all">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-action border border-border/80">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-default">
                  پیشرفت پروژه‌ها
                </h3>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted border border-border">
                  {data.projects.length.toLocaleString('fa-IR')} پروژه
                </span>
                <Link href="/projects" className="text-xs font-bold text-action hover:underline flex items-center gap-0.5">
                  <span>مشاهده همه</span>
                  <ChevronLeft className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Projects List: Sorted by highest completion percentage */}
            {sortedProjects.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-center text-xs text-muted border border-dashed border-border rounded-xl font-medium">
                هیچ پروژه‌ای تعریف نشده است.
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-2.5">
                {sortedProjects.slice(0, 4).map((p) => {
                  const deptConfig = p.department ? DEPARTMENTS[p.department as DepartmentKey] : null
                  const color = getProjectColor(p, p.pIdx)

                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}/board`}
                      className="group block rounded-xl border border-border/70 bg-surface-2/40 p-3 transition-all hover:bg-surface-2 hover:border-action/50 hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${color.gradient} text-white text-xs font-bold shadow-xs`}>
                            {p.name.charAt(0)}
                          </span>
                          <h4 className="truncate text-xs sm:text-sm font-bold text-default group-hover:text-action transition-colors">
                            {p.name}
                          </h4>
                          {deptConfig && (
                            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${deptConfig.badgeClass}`}>
                              {deptConfig.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <span className="text-muted font-bold text-xs">
                            {p.projDone.toLocaleString('fa-IR')} از {p.projTasks.length.toLocaleString('fa-IR')}
                          </span>
                          <span className={`font-black ${color.text}`}>{p.pct}٪</span>
                        </div>
                      </div>

                      {/* Accent Progress Bar */}
                      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color.gradient} transition-all duration-500`}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5. Bottom Row: Recent Tasks & Leaderboard Top Performers */}
        {/* 5. Bottom Row: Recent Tasks & Leaderboard Top Performers */}
        <div className="grid gap-3.5 sm:gap-5 lg:grid-cols-12">
          {/* Recent Tasks Stream (6 cols) */}
          <div className="lg:col-span-6 rounded-xl sm:rounded-2xl border-[1.5px] border-border bg-surface p-3 sm:p-5 shadow-[2px_2px_0_#202A5A] sm:shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] sm:dark:shadow-[2.5px_2.5px_0_#59BBAF] space-y-2.5 sm:space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5 sm:mb-3.5">
                <h3 className="text-xs sm:text-base font-black text-default">
                  آخرین کارهای تعریف‌شده
                </h3>
                <Link href="/projects" className="text-[11px] sm:text-xs font-bold text-action hover:underline flex items-center gap-0.5">
                  <span>مشاهده همه</span>
                  <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {data.tasks.slice(0, 5).map((t) => {
                  const proj = data.projects.find((p) => p.id === t.project_id)
                  const conf = STATUS_CONFIG[t.status] || STATUS_CONFIG.backlog

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-2/40 p-2.5 sm:p-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black shadow-2xs ${conf.bg} ${conf.color}`}>
                          {t.status === 'done' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : t.status === 'in_progress' ? (
                            <Clock className="h-3.5 w-3.5" />
                          ) : t.status === 'todo' ? (
                            <CircleDot className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h5 className="truncate text-xs sm:text-sm font-bold text-default" title={t.title}>
                            {t.title}
                          </h5>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-muted font-medium">
                            <span className="truncate max-w-[110px] sm:max-w-none">{proj?.name || 'پروژه عمومی'}</span>
                            {t.priority === 'urgent' && (
                              <span className="shrink-0 rounded bg-rose-500/10 text-rose-500 px-1.5 py-0.2 font-black text-[9px] sm:text-[10px]">فوری</span>
                            )}
                            {t.priority === 'important' && (
                              <span className="shrink-0 rounded bg-amber-500/10 text-amber-500 px-1.5 py-0.2 font-black text-[9px] sm:text-[10px]">مهم</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center items-end gap-1 sm:gap-2 shrink-0">
                        <span className="text-[11px] sm:text-xs font-black text-[#F8A41D] flex items-center gap-0.5 whitespace-nowrap">
                          <Zap className="h-3 w-3 text-[#F8A41D]" />
                          <span>{(t.xp_value || 0).toLocaleString('fa-IR')} XP</span>
                        </span>
                        <span className={`rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-bold border whitespace-nowrap ${conf.bg} ${conf.color}`}>
                          {conf.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Top Performers Spotlight (6 cols) */}
          <div className="lg:col-span-6 rounded-xl sm:rounded-2xl border-[1.5px] border-border bg-surface p-3 sm:p-5 shadow-[2px_2px_0_#202A5A] sm:shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] sm:dark:shadow-[2.5px_2.5px_0_#59BBAF] space-y-2.5 sm:space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5 sm:mb-3.5">
                <h3 className="text-xs sm:text-base font-black text-default">
                  پیشتازان لیدربورد
                </h3>
                <Link href="/leaderboard" className="text-[11px] sm:text-xs font-bold text-action hover:underline flex items-center gap-0.5">
                  <span>جدول کامل</span>
                  <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Link>
              </div>

              {metrics.topPerformers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-8 sm:py-10 text-center text-xs text-muted border border-dashed border-border rounded-xl font-medium">
                  هنوز عضوی ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.topPerformers.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`group cursor-pointer select-none flex items-center justify-between gap-2 sm:gap-3 rounded-xl border p-2.5 sm:p-3 transition-all hover:border-action/50 hover:shadow-xs active:scale-[0.99] ${
                        idx === 0
                          ? 'border-amber-400/50 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                          : 'border-border/70 bg-surface-2/40 hover:bg-surface-2'
                      }`}
                      title="مشاهده کارنامه و عملکرد"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        {/* Rank Medal */}
                        <span className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg text-[10px] sm:text-xs font-black shadow-xs ${
                          idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950'
                            : idx === 1
                            ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-900'
                            : idx === 2
                            ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white'
                            : 'bg-surface-2 text-muted border border-border/80'
                        }`}>
                          {idx === 0 ? (
                            <Crown className="h-3.5 w-3.5" />
                          ) : idx === 1 || idx === 2 ? (
                            <Medal className="h-3.5 w-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        {/* Avatar */}
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#59BBAF] to-[#202A5A] text-[10px] sm:text-xs font-black text-white shadow-2xs overflow-hidden">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.full_name} className="h-full w-full object-cover" />
                          ) : (
                            m.full_name.charAt(0)
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h5 className="truncate text-xs sm:text-sm font-bold text-default group-hover:text-action transition-colors" title={m.full_name}>
                              {m.full_name}
                            </h5>
                            {idx === 0 && (
                              <span className="shrink-0 rounded-md bg-amber-400/20 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400">
                                پیشتاز
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {Array.isArray(m.departments) && m.departments.length > 0 ? (
                              m.departments.slice(0, 2).map((d) => (
                                <span key={d.department} className={`rounded px-1.5 py-0 text-[9px] sm:text-[10px] font-bold ${DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-muted'}`}>
                                  {DEPARTMENTS[d.department]?.shortLabel || DEPARTMENTS[d.department]?.label || d.department} (سطح {d.level})
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] sm:text-[10px] text-muted font-medium">عضو باشگاه</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* XP Score */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 border border-[#F8A41D]/30 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-black text-[#BA7B16] dark:text-[#fde047] flex items-center gap-0.5 sm:gap-1 shadow-2xs whitespace-nowrap">
                          <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#F8A41D]" />
                          <span>{(m.xp_total ?? 0).toLocaleString('fa-IR')} XP</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
        initialMember={data.members.find((m) => m.id === selectedMemberId) || null}
        isAdmin={true}
      />
    </div>
  )
}
