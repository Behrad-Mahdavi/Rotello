'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/utils/database.types'

interface TaskCardProps {
  task: Task
  canDrag: boolean
  onClick: () => void
}

const STATUS_BORDER: Record<string, string> = {
  backlog: 'border-r-gray-400/60',
  todo: 'border-r-slate-400/60',
  in_progress: 'border-r-emerald-500/60',
  review: 'border-r-amber-500/60',
  done: 'border-r-teal-500/60',
}

const PRIORITY_BADGE: Record<string, string> = {
  normal: 'bg-sky-500/10 text-sky-400',
  important: 'bg-orange-500/10 text-orange-400',
  urgent: 'bg-rose-500/10 text-rose-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'بک‌لاگ',
  todo: 'انجام',
  in_progress: 'در حال',
  review: 'بازبینی',
  done: 'تکمیل',
}

export default function TaskCard({ task, canDrag, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, disabled: !canDrag,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(canDrag ? listeners : {})} onClick={onClick}
      className={`group cursor-pointer rounded-lg border border-border bg-surface p-2.5 transition-all hover:shadow-md sm:p-3 ${STATUS_BORDER[task.status]} border-r-2 ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      } ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-1.5">
        {canDrag && (
          <span className="mt-0.5 shrink-0 text-muted/30 group-hover:text-muted/60">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM8 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM8 22a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
            </svg>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-default sm:text-sm">{task.title}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              task.status === 'done' ? 'bg-teal-500/10 text-teal-400' :
              task.status === 'review' ? 'bg-amber-500/10 text-amber-400' :
              task.status === 'in_progress' ? 'bg-emerald-500/10 text-emerald-400' :
              task.status === 'todo' ? 'bg-slate-500/10 text-slate-400' :
              'bg-gray-500/10 text-gray-400'
            }`}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {task.xp_value > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {task.xp_value}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
