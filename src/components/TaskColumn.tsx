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
      className={`flex w-[244px] shrink-0 flex-col rounded-2xl transition-all sm:w-[272px] ${
        isOver ? 'bg-action/5 shadow-sm' : meta.bg
      }`}>
      <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1.5 sm:px-4 sm:pt-4 sm:pb-3">
        <div className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <h3 className="text-xs font-bold text-default">{title}</h3>
        <span className={`mr-auto flex h-5 min-w-[20px] items-center justify-center rounded-full ${meta.labelBg} px-1.5 text-[11px] font-semibold text-subtle`}>
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className={`flex flex-1 flex-col gap-1.5 p-1.5 pt-0 sm:gap-2 sm:p-3 min-h-[50px] sm:min-h-[80px] overflow-y-auto`}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDrag={canDragTask(task)} onClick={() => onTaskClick(task)} />
          ))}
          {tasks.length === 0 && !isOver && (
            <div className="flex flex-1 items-center justify-center rounded-xl py-6 text-[11px] text-muted sm:text-xs">
              بدون تسک
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
