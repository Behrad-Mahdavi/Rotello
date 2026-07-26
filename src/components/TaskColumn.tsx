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

const STAGE_META: Record<TaskStatus, { dot: string; bg: string; labelBg: string }> = {
  backlog:     { dot: 'bg-stage-backlog',     bg: 'bg-stage-backlog/8',     labelBg: 'bg-stage-backlog/12' },
  todo:        { dot: 'bg-stage-todo',        bg: 'bg-stage-todo/8',        labelBg: 'bg-stage-todo/12' },
  in_progress: { dot: 'bg-stage-in-progress', bg: 'bg-stage-in-progress/8', labelBg: 'bg-stage-in-progress/12' },
  done:        { dot: 'bg-stage-done',        bg: 'bg-stage-done/8',        labelBg: 'bg-stage-done/12' },
}

export default function TaskColumn({ id, title, tasks, canDragTask, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = STAGE_META[id]

  return (
    <div ref={setNodeRef}
      className={`flex w-[272px] shrink-0 flex-col rounded-2xl transition-all ${
        isOver ? 'bg-action/5 shadow-sm' : meta.bg
      }`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <h3 className="text-xs font-bold text-default">{title}</h3>
        <span className={`mr-auto flex h-5 min-w-[20px] items-center justify-center rounded-full ${meta.labelBg} px-1.5 text-[11px] font-semibold text-subtle`}>
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex flex-col gap-2 p-3 pt-0 min-h-[80px] ${tasks.length === 0 ? 'flex-1' : ''} overflow-y-auto`}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDrag={canDragTask(task)} onClick={() => onTaskClick(task)} />
          ))}
          {tasks.length === 0 && !isOver && (
            <div className="flex flex-1 items-center justify-center rounded-xl text-xs text-muted">
              بدون تسک
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
