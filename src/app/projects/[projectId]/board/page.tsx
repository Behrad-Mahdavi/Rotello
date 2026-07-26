'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import TaskColumn from '@/components/TaskColumn'
import TaskCard from '@/components/TaskCard'
import TaskDetailModal from '@/components/TaskDetailModal'
import CreateTaskModal from '@/components/CreateTaskModal'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import type { Task, TaskStatus, Profile, Project } from '@/utils/database.types'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

function Sidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col bg-surface">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface shadow-sm overflow-hidden">
          <Image src="/logog.png" alt="رکاد" width={24} height={24} className="object-contain" />
        </div>
        <span className="text-sm font-bold text-default">پنل مدیریت</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" dir="rtl">
        <Link href="/admin/members"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            currentPath === '/admin/members' ? 'bg-admin-subtle text-admin' : 'text-subtle hover:bg-admin-subtle hover:text-admin'
          }`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          مدیریت اعضا
        </Link>
        <Link href="/admin/projects"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            currentPath === '/admin/projects' ? 'bg-admin-subtle text-admin' : 'text-subtle hover:bg-admin-subtle hover:text-admin'
          }`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          پروژه‌ها
        </Link>
      </nav>

      <div className="p-3">
        <LogoutButton />
      </div>
    </aside>
  )
}

export default function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [myAssigneeTaskIds, setMyAssigneeTaskIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { params.then((p) => setProjectId(p.projectId)) }, [])

  useEffect(() => {
    if (!projectId) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
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

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted">...</div>

  const boardContent = (
    <>
      {isAdmin ? (
        <header className="flex shrink-0 items-center justify-between bg-surface/80 backdrop-blur-lg px-4 h-14 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface shadow-sm overflow-hidden">
              <Image src="/logog.png" alt="رکاد" width={20} height={20} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-default">{project?.name || 'بورد'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3.5 py-1.5 text-xs font-medium text-on-dark transition-all hover:bg-action-hover shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              تسک جدید
            </button>
            <LogoutButton minimal />
          </div>
        </header>
      ) : (
        <header className="flex shrink-0 items-center justify-between bg-surface/80 backdrop-blur-lg px-4 h-14 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/projects')}
              className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-subtle transition-colors hover:bg-canvas">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              بازگشت
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface shadow-sm overflow-hidden">
              <Image src="/logog.png" alt="رکاد" width={20} height={20} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-default">{project?.name || 'بورد'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-warning-subtle px-3 py-1.5 text-xs font-medium text-xp">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {profile?.xp_total}
            </span>
            <LogoutButton minimal />
          </div>
        </header>
      )}

      {error && (
        <div className="mx-4 mt-2">
          <div className="rounded-xl bg-danger-subtle px-4 py-2.5 text-sm text-danger">{error}</div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-3" style={{ minWidth: COLUMNS.length * 280 + (COLUMNS.length - 1) * 12 }}>
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

      {selectedTask && <TaskDetailModal taskId={selectedTask.id} onClose={() => setSelectedTask(null)} profile={profile!}
        onTaskDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))} />}
      {showCreateModal && (
        <CreateTaskModal projectId={projectId} onClose={() => setShowCreateModal(false)}
          onTaskCreated={(task) => { setTasks((prev) => [...prev, task]); setShowCreateModal(false) }} />
      )}
    </>
  )

  if (isAdmin) {
    return (
      <div className="flex h-screen" dir="rtl">
        <Sidebar currentPath="/admin/projects" />
        <div className="flex flex-1 flex-col bg-canvas">
          {boardContent}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-canvas" dir="rtl">
      {boardContent}
    </div>
  )
}
