'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import TaskColumn from '@/components/TaskColumn'
import TaskCard from '@/components/TaskCard'
import TaskDetailModal from '@/components/TaskDetailModal'
import CreateTaskModal from '@/components/CreateTaskModal'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import type { Task, TaskStatus, Profile, Project } from '@/utils/database.types'

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
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => { params.then((p) => setProjectId(p.projectId)) }, [])

  useEffect(() => {
    if (!projectId) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single()
      setProject(proj)
      const { data: t } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
      if (t) setTasks(t)
      const { data: aa } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id)
      if (aa) setMyAssigneeTaskIds(aa.map((a) => a.task_id))
      setLoading(false)
    }
    load()
  }, [projectId])

  const getTasksByStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s)

  const canDragTask = useCallback((task: Task) => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    return myAssigneeTaskIds.includes(task.id)
  }, [profile, myAssigneeTaskIds])

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

  return (
    <div className="flex h-screen flex-col bg-canvas overflow-hidden" dir="rtl">
      <AppHeader profile={profile} />

      <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/projects')}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-default">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">پروژه‌ها</span>
          </button>
          <span className="text-muted/40">/</span>
          <span className="text-xs font-medium text-default sm:text-sm">{project?.name || 'بورد'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-700 sm:gap-1.5 sm:px-3">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">تسک جدید</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 sm:gap-1.5 sm:px-3">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {profile?.xp_total}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-3 mt-2 sm:mx-4">
          <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-400 sm:px-4 sm:py-2.5 sm:text-sm">{error}</div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-2 sm:p-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-2 sm:gap-3" style={{ minWidth: COLUMNS.length * 252 + (COLUMNS.length - 1) * 8 }}>
            {COLUMNS.map((col) => (
              <TaskColumn key={col.id} id={col.id} title={col.title}
                tasks={getTasksByStatus(col.id)} canDragTask={canDragTask} onTaskClick={setSelectedTask} />
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
        onTaskDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))} />}
      {showCreateModal && (
        <CreateTaskModal projectId={projectId} onClose={() => setShowCreateModal(false)}
          onTaskCreated={(task) => { setTasks((prev) => [...prev, task]); setShowCreateModal(false) }} />
      )}
    </div>
  )
}
