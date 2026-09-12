'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'
import type { Task, TaskStatus } from '@/utils/database.types'

interface TaskColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
  canDragTask: (task: Task) => boolean
  onTaskClick: (task: Task) => void
}

const STAGE_META: Record<TaskStatus, { dot: string; badge: string }> = {
  backlog:     { dot: 'bg-slate-400', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  todo:        { dot: 'bg-[#202A5A] dark:bg-blue-400', badge: 'bg-[#202A5A]/10 text-[#202A5A] dark:bg-blue-500/15 dark:text-blue-300' },
  in_progress: { dot: 'bg-[#4DA59A] dark:bg-[#59BBAF]', badge: 'bg-[#4DA59A]/15 text-[#2E7A71] dark:bg-[#59BBAF]/20 dark:text-[#7FD3C8]' },
  review:      { dot: 'bg-[#F8A41D]', badge: 'bg-[#F8A41D]/15 text-[#B45309] dark:text-amber-300' },
  done:        { dot: 'bg-[#652D90] dark:bg-[#A78BFA]', badge: 'bg-[#652D90]/10 text-[#652D90] dark:bg-purple-500/20 dark:text-purple-300' },
}

export default function TaskColumn({ id, title, tasks, canDragTask, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = STAGE_META[id]

  return (
    <div className="flex w-[252px] shrink-0 flex-col rounded-2xl bg-surface-2/70 border border-border/80 transition-all duration-200 sm:w-[280px] shadow-2xs">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-3.5 sm:py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} shadow-xs`} />
          <h3 className="text-xs sm:text-sm font-bold text-default">{title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>
            {tasks.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors overflow-y-auto scrollbar-thin sm:p-2.5 ${
          isOver ? 'bg-action/10 ring-2 ring-action/40 rounded-b-2xl' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDrag={canDragTask(task)} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 py-8 text-xs text-muted">
            بدون تسک
          </div>
        )}
      </div>
    </div>
  )
}
