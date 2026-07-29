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
  backlog:     { dot: 'bg-gray-400',        badge: 'bg-gray-500/10 text-gray-400' },
  todo:        { dot: 'bg-slate-400',       badge: 'bg-slate-500/10 text-slate-400' },
  in_progress: { dot: 'bg-emerald-500',     badge: 'bg-emerald-500/10 text-emerald-400' },
  review:      { dot: 'bg-amber-500',       badge: 'bg-amber-500/10 text-amber-400' },
  done:        { dot: 'bg-teal-500',        badge: 'bg-teal-500/10 text-teal-400' },
}

export default function TaskColumn({ id, title, tasks, canDragTask, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = STAGE_META[id]

  return (
    <div className="flex w-[244px] shrink-0 flex-col rounded-xl bg-surface-2/40 ring-1 ring-border/60 transition-all sm:w-[272px]">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
          <h3 className="text-xs font-semibold text-default sm:text-sm">{title}</h3>
          <span className={`rounded-full px-1.5 text-[11px] font-medium ${meta.badge}`}>
            {tasks.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[100px] flex-1 flex-col gap-1.5 px-1.5 pb-1.5 transition-colors overflow-y-auto scrollbar-thin sm:gap-2 sm:px-2 sm:pb-2 ${
          isOver ? 'bg-emerald-500/5' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDrag={canDragTask(task)} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-[11px] text-muted sm:text-xs">
            بدون تسک
          </div>
        )}
      </div>
    </div>
  )
}
