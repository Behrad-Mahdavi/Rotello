'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import EditProjectModal from '@/components/EditProjectModal'
import DeleteProjectModal from '@/components/DeleteProjectModal'
import ProjectMembersModal from '@/components/ProjectMembersModal'
import { formatToPersianDate, toPersianDigits } from '@/utils/jalaali'
import { DEPARTMENTS, type DepartmentKey } from '@/constants/departments'
import type { Project, Profile, Role, MemberDepartment } from '@/utils/database.types'
import { X, Zap, Users } from 'lucide-react'

interface TaskSummary {
  id: string
  project_id: string
  status: string
  xp_value?: number | null
  title?: string
}

export default function ProjectsListPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [myAssignedProjectIds, setMyAssignedProjectIds] = useState<string[]>([])
  const [projectMembersMap, setProjectMembersMap] = useState<Record<string, string[]>>({})
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profRes, projRes, tasksRes, assignRes, mapRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('id, project_id, status, xp_value, title'),
        supabase.from('task_assignees').select('task_id, tasks(project_id)').eq('user_id', user.id),
        fetch('/api/projects/members-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
      ])

      const userRole: Role = (user.user_metadata?.role || profRes.data?.role || 'member') as Role
      const userDeps: MemberDepartment[] = profRes.data?.departments || (user.user_metadata?.departments as MemberDepartment[]) || []

      const fullProfile: Profile = {
        ...(profRes.data || { id: user.id, full_name: user.user_metadata?.full_name || 'کاربر', xp_total: 0, created_at: '' }),
        role: userRole,
        departments: userDeps,
      }

      setProfile(fullProfile)
      if (projRes.data) setProjects(projRes.data)
      if (tasksRes.data) setTasks(tasksRes.data)
      if (mapRes?.map) setProjectMembersMap(mapRes.map)

      const assignedPids = new Set<string>()
      if (assignRes.data) {
        for (const item of assignRes.data) {
          const t = item.tasks as unknown as { project_id?: string } | null
          if (t?.project_id) {
            assignedPids.add(t.project_id)
          }
        }
      }
      setMyAssignedProjectIds(Array.from(assignedPids))

      setLoading(false)
    }
    load()
  }, [router, supabase])

  // Accessible projects according to Role:
  // - Admin: All projects
  // - Mentor: Projects of their departments OR projects where they are assigned tasks/members
  // - Member: Only projects where they are assigned tasks OR are project members
  const accessibleProjects = useMemo(() => {
    if (!profile) return []

    if (profile.role === 'admin') {
      return projects
    }

    if (profile.role === 'mentor') {
      const mentorDeps = (profile.departments || []).map((d) => d.department)
      return projects.filter((p) => {
        // Project matching mentor's department
        if (p.department && mentorDeps.includes(p.department)) return true
        // Project where mentor is assigned
        if (myAssignedProjectIds.includes(p.id)) return true
        // Project where mentor is a project member
        if ((projectMembersMap[p.id] || []).includes(profile.id)) return true
        return false
      })
    }

    // Member: only assigned projects or project members
    return projects.filter((p) => myAssignedProjectIds.includes(p.id) || (projectMembersMap[p.id] || []).includes(profile.id))
  }, [projects, profile, myAssignedProjectIds, projectMembersMap])

  // Map task stats by project id
  const projectStats = useMemo(() => {
    const map: Record<string, { total: number; done: number; pct: number; totalXp: number }> = {}
    for (const t of tasks) {
      if (t.title === '__PROJECT_ROSTER__') continue
      if (!map[t.project_id]) map[t.project_id] = { total: 0, done: 0, pct: 0, totalXp: 0 }
      map[t.project_id].total++
      map[t.project_id].totalXp += (Number(t.xp_value) || 0)
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
    if (!searchQuery.trim()) return accessibleProjects
    const q = searchQuery.toLowerCase().trim()
    return accessibleProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    )
  }, [accessibleProjects, searchQuery])

  // Helper for deadline status
  function getDeadlineInfo(deadlineStr: string | null) {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)
    
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const formatted = formatToPersianDate(deadlineStr)

    if (diffDays < 0) {
      return { label: 'مهلت تمام شده', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', formatted }
    } else if (diffDays === 0) {
      return { label: 'امروز آخرین مهلت', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', formatted }
    } else if (diffDays <= 3) {
      return { label: `${toPersianDigits(diffDays)} روز تا موعد`, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', formatted }
    }
    return { label: `${toPersianDigits(diffDays)} روز باقی‌مانده`, color: 'bg-surface-2 text-muted border-border', formatted }
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8 space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="h-10 w-48 rounded-2xl bg-surface-2/70" />
            <div className="h-10 w-64 rounded-2xl bg-surface-2/70" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-surface-2/70 border border-border/80" />
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-default">پروژه‌ها</h1>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
              {projects.length} پروژه
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            {projects.length > 2 && (
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی پروژه..."
                  className="w-full sm:w-60 rounded-xl border border-border bg-surface px-3 py-2 pr-9 text-xs transition-all focus:border-action focus:ring-2 focus:ring-action/20 focus:outline-none min-h-[38px]"
                />
                <svg
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted pointer-events-none"
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
                    className="absolute left-2.5 top-2.5 text-xs text-muted hover:text-default cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Admin Add Project Button */}
            {profile?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/projects')}
                className="rokad-btn-primary px-3.5 sm:px-4 py-2 text-xs sm:text-sm shrink-0 min-h-[38px] flex items-center justify-center gap-1.5"
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
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, i) => {
            const g = gradients[i % gradients.length]
            const stats = projectStats[project.id] || { total: 0, done: 0, pct: 0, totalXp: 0 }
            const deadline = getDeadlineInfo(project.deadline)

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}/board`)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-[1.5px] border-border bg-surface p-0 text-right shadow-[2.75px_2.75px_0_#202A5A] dark:shadow-[2.75px_2.75px_0_#59BBAF] transition-all duration-200 hover:-translate-y-1 hover:shadow-[3.5px_3.5px_0_#202A5A] dark:hover:shadow-[3.5px_3.5px_0_#59BBAF] hover:border-action/50 active:scale-[0.98] cursor-pointer"
                title={`ورود به بورد پروژه ${project.name}`}
              >
                {/* Top Accent Gradient Bar */}
                <div className={`h-2 w-full bg-gradient-to-r ${g.bar}`} />

                {/* Card Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header with Initial & Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${g.badge} text-white text-lg font-black shadow-md transition-transform duration-200 group-hover:scale-105`}
                      >
                        {project.name.charAt(0)}
                      </span>

                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {profile?.role === 'admin' && (
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setProjectToEdit(project)
                              }}
                              className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-action cursor-pointer"
                              title="ویرایش پروژه"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setProjectToDelete({ id: project.id, name: project.name })
                              }}
                              className="rounded-lg p-1 text-muted transition hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                              title="حذف پروژه"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {project.department && (project.department in DEPARTMENTS) && (
                          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${DEPARTMENTS[project.department as DepartmentKey].badgeClass}`}>
                            {DEPARTMENTS[project.department as DepartmentKey].label}
                          </span>
                        )}

                        {deadline && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${deadline.color}`}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{deadline.label}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-base font-bold text-default group-hover:text-action transition-colors line-clamp-1">
                      {project.name}
                    </h2>

                    {/* Description */}
                    <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed min-h-[2rem]">
                      {project.description || 'بدون توضیحات ثبت‌شده برای این پروژه.'}
                    </p>
                  </div>

                  {/* Stats & Progress Section */}
                  <div className="mt-5 pt-4 border-t border-border/70 space-y-2.5">
                    <div className="flex items-center justify-between text-xs gap-1">
                      <span className="text-muted font-medium text-[11px] sm:text-xs truncate">
                        {stats.total > 0 ? `${stats.done} از ${stats.total} تسک` : 'بدون تسک'}
                      </span>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 font-black text-[#BA7B16] dark:text-[#fde047] text-[11px] sm:text-xs">
                          <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#F8A41D]" />
                          <span>{(stats.totalXp || 0).toLocaleString('fa-IR')} XP</span>
                        </span>
                        <span className="text-muted/30">•</span>
                        <span className="font-bold text-default text-[11px] sm:text-xs">
                          {stats.pct}٪
                        </span>
                      </div>
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
                <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-semibold text-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedProjectForMembers(project)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2 py-1 text-[11px] font-bold text-default hover:text-action hover:border-action/40 transition-colors shadow-2xs"
                      title="مشاهده و مدیریت اعضای این پروژه"
                    >
                      <Users className="h-3.5 w-3.5 text-action" />
                      <span>{(projectMembersMap[project.id]?.length || 0)} عضو</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 group-hover:text-action transition-colors">
                    <span className="text-[11px] sm:text-xs">مشاهده بورد</span>
                    <span className="text-base transition-transform duration-200 group-hover:-translate-x-1">
                      ←
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
              {searchQuery
                ? 'هیچ پروژه‌ای مطابق با جستجوی شما یافت نشد.'
                : profile?.role === 'member'
                ? 'شما در حال حاضر در هیچ پروژه‌ای عضویتی ندارید و تسک فعالی برای شما ثبت نشده است.'
                : profile?.role === 'mentor'
                ? 'پروژه‌ای متناسب با دپارتمان‌های شما یا پروژه‌های دارای تسک یافت نشد.'
                : 'هنوز هیچ پروژه‌ای تعریف نشده است.'}
            </div>
          )}
        </div>
      </main>

      {/* Edit Project Modal */}
      {projectToEdit && (
        <EditProjectModal
          isOpen={!!projectToEdit}
          project={projectToEdit}
          onClose={() => setProjectToEdit(null)}
          onProjectUpdated={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }}
        />
      )}

      {/* Delete Project Modal */}
      {projectToDelete && (
        <DeleteProjectModal
          isOpen={!!projectToDelete}
          projectId={projectToDelete.id}
          projectName={projectToDelete.name}
          onClose={() => setProjectToDelete(null)}
          onProjectDeleted={(deletedId) => {
            setProjects((prev) => prev.filter((p) => p.id !== deletedId))
          }}
        />
      )}

      {/* Project Members Modal */}
      {selectedProjectForMembers && (
        <ProjectMembersModal
          isOpen={!!selectedProjectForMembers}
          projectId={selectedProjectForMembers.id}
          projectName={selectedProjectForMembers.name}
          onClose={() => setSelectedProjectForMembers(null)}
          canManage={profile?.role === 'admin' || profile?.role === 'mentor'}
          onMembersUpdated={(newMembers) => {
            setProjectMembersMap((prev) => ({
              ...prev,
              [selectedProjectForMembers.id]: newMembers.map((m) => m.id),
            }))
          }}
        />
      )}
    </div>
  )
}
