'use client'

import { useEffect, useState, useCallback, use, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import TaskColumn from '@/components/TaskColumn'
import TaskCard from '@/components/TaskCard'
import TaskDetailModal from '@/components/TaskDetailModal'
import CreateTaskModal from '@/components/CreateTaskModal'
import ProjectMembersModal from '@/components/ProjectMembersModal'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import type { Task, TaskStatus, Profile, Project, Role } from '@/utils/database.types'
import { Lock, Zap, Users } from 'lucide-react'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'بک‌لاگ' },
  { id: 'todo', title: 'در صف انجام' },
  { id: 'in_progress', title: 'در حال انجام' },
  { id: 'review', title: 'در حال بازبینی' },
  { id: 'done', title: 'تکمیل‌شده' },
]

export default function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [myAssigneeTaskIds, setMyAssigneeTaskIds] = useState<string[]>([])
  const [projectMembers, setProjectMembers] = useState<Profile[]>([])
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState('')
  const { projectId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const totalProjectXp = useMemo(() => {
    return tasks.reduce((sum, t) => sum + (Number(t.xp_value) || 0), 0)
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => {
    if (!projectId) return
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      const [profRes, projRes, tasksRes, assigneeRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
        supabase.from('task_assignees').select('task_id').eq('user_id', user.id),
        fetch(`/api/projects/${projectId}/members`).then((r) => r.ok ? r.json() : { members: [] }).catch(() => ({ members: [] })),
      ])
      const userRole = (user.user_metadata?.role || profRes.data?.role || 'member') as Role
      const userDeps = profRes.data?.departments || (user.user_metadata?.departments || [])

      const fullProfile: Profile = {
        ...(profRes.data || { id: user.id, full_name: user.user_metadata?.full_name || 'کاربر', xp_total: 0, created_at: '' }),
        role: userRole,
        departments: userDeps,
      }

      if (profRes.data) setProfile(fullProfile)
      if (projRes.data) setProject(projRes.data)
      if (tasksRes.data) setTasks(tasksRes.data)
      if (membersRes?.members) setProjectMembers(membersRes.members)
      const myTaskIds = (assigneeRes.data || []).map((a: { task_id: string }) => a.task_id)
      setMyAssigneeTaskIds(myTaskIds)
      setLoading(false)
    }
    load()
  }, [projectId])

  // Check access permission:
  // - Admin: always allowed
  // - Mentor: allowed if project belongs to mentor's department OR mentor is assigned/member
  // - Member: allowed if member is in project members OR has tasks in project
  const hasAccess = useMemo(() => {
    if (!profile || !project) return true
    if (profile.role === 'admin') return true

    const projectTaskIds = new Set(tasks.map((t) => t.id))
    const isAssignedInProject = myAssigneeTaskIds.some((id) => projectTaskIds.has(id))
    const isProjectMember = projectMembers.some((m) => m.id === profile.id)

    if (profile.role === 'mentor') {
      const mentorDeps = (profile.departments || []).map((d) => d.department)
      if (project.department && mentorDeps.includes(project.department)) return true
      return isAssignedInProject || isProjectMember
    }

    // Member: must have assigned tasks or be a project member
    return isAssignedInProject || isProjectMember
  }, [profile, project, tasks, myAssigneeTaskIds, projectMembers])

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { backlog: [], todo: [], in_progress: [], review: [], done: [] }
    for (const t of tasks) grouped[t.status]?.push(t)
    return grouped
  }, [tasks])

  const canDragTask = useCallback((task: Task) => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    if (profile.role === 'mentor') {
      const mentorDeps = (profile.departments || []).map((d) => d.department)
      if (project?.department && mentorDeps.includes(project.department)) return true
    }
    return myAssigneeTaskIds.includes(task.id)
  }, [profile, project, myAssigneeTaskIds])

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as TaskStatus
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return
    const { error: err } = await supabase.rpc('move_task_status', { p_task_id: taskId, p_new_status: newStatus })
    if (err) { setError(err.message); return }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    setError('')
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task && canDragTask(task)) setActiveTask(task)
  }

  const isAdmin = profile?.role === 'admin'

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )
  if (!profile) return null

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
        <AppHeader profile={profile} />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 shadow-sm">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-default mb-2">عدم دسترسی به این پروژه</h2>
          <p className="text-xs text-muted leading-relaxed mb-6">
            {profile.role === 'member'
              ? 'شما عضو این پروژه نیستید و تسکی برای شما در آن ثبت نشده است.'
              : 'این پروژه مربوط به دپارتمان‌های شما نیست و عضویتی در آن ندارید.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/projects')}
            className="rounded-xl bg-action px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-action-hover transition-all active:scale-95"
          >
            مشاهده پروژه‌های من
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-canvas overflow-hidden" dir="rtl">
      <AppHeader profile={profile} />

      <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-2.5 py-1.5 sm:px-4 sm:py-2 gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <button onClick={() => router.push('/projects')}
            className="flex items-center gap-1 rounded-lg px-1.5 sm:px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-default shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">پروژه‌ها</span>
          </button>
          <span className="text-muted/40 shrink-0">/</span>
          <span className="text-xs font-bold text-default sm:text-sm truncate max-w-[85px] xs:max-w-[110px] sm:max-w-xs">{project?.name || 'بورد'}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Project Members Widget */}
          <button
            onClick={() => setShowMembersModal(true)}
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-border bg-surface px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-xs font-semibold text-default hover:bg-surface-2 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="مشاهده و مدیریت اعضای پروژه"
          >
            <div className="flex -space-x-1.5 rtl:space-x-reverse overflow-hidden items-center">
              {projectMembers.slice(0, 3).map((m) => (
                <div key={m.id} className="h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-full border border-surface bg-action/20 text-[9px] font-bold text-action flex items-center justify-center overflow-hidden">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    m.full_name?.charAt(0)
                  )}
                </div>
              ))}
            </div>
            <span className="hidden sm:inline">اعضای پروژه</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] font-bold text-muted">
              {projectMembers.length}
            </span>
          </button>

          <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-[#F8A41D]/30 bg-[#FEF6E8] dark:bg-[#57390A]/40 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-black text-[#BA7B16] dark:text-[#fde047] shadow-xs" title="مجموع امتیازات کل تسک‌های این پروژه">
            <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#F8A41D]" />
            <span className="text-muted font-medium hidden sm:inline">مجموع:</span>
            <span>{totalProjectXp.toLocaleString('fa-IR')} XP</span>
          </div>

          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-action px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-action-hover active:scale-95 sm:gap-1.5 sm:px-3">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">تسک جدید</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mt-2 sm:mx-4">
          <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400 sm:px-4 sm:py-2.5 sm:text-sm">{error}</div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-2 sm:p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-2 sm:gap-3" style={{ minWidth: COLUMNS.length * 252 + (COLUMNS.length - 1) * 8 }}>
            {COLUMNS.map((col) => (
              <TaskColumn key={col.id} id={col.id} title={col.title}
                tasks={tasksByStatus[col.id] || []} canDragTask={canDragTask} onTaskClick={setSelectedTask} />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <div className="rotate-3 opacity-90"><TaskCard task={activeTask} canDrag onClick={() => {}} /></div>}
          </DragOverlay>
        </DndContext>
      </main>

      <div className="flex shrink-0 items-center justify-center gap-1.5 py-1.5 sm:hidden">
        <div className="h-1.5 w-1.5 rounded-full bg-muted/40" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted/40" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted/40" />
        <span className="mr-1 text-[10px] text-muted/60">اسکرول کنید ←</span>
      </div>

      {selectedTask && <TaskDetailModal taskId={selectedTask.id} onClose={() => setSelectedTask(null)} profile={profile}
        onTaskDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
        onTaskUpdated={(updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))} />}
      {showCreateModal && (
        <CreateTaskModal projectId={projectId} onClose={() => setShowCreateModal(false)}
          onTaskCreated={(task) => { setTasks((prev) => [...prev, task]); setShowCreateModal(false) }}
          onOpenMembersModal={() => { setShowCreateModal(false); setShowMembersModal(true) }} />
      )}
      <ProjectMembersModal
        isOpen={showMembersModal}
        projectId={projectId}
        projectName={project?.name || ''}
        onClose={() => setShowMembersModal(false)}
        canManage={isAdmin || profile?.role === 'mentor'}
        onMembersUpdated={(newMembers) => setProjectMembers(newMembers)}
      />
    </div>
  )
}
