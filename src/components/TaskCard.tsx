'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/utils/database.types'

interface TaskCardProps {
  task: Task
  canDrag: boolean
  onClick: () => void
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
      className={`rounded-xl bg-surface p-2.5 shadow-sm transition-all sm:p-3.5 ${
        canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-pointer hover:shadow-md'
      } ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <p className="text-xs font-medium leading-snug text-default line-clamp-2 sm:text-sm">{task.title}</p>
      {task.xp_value > 0 && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-xp sm:mt-2 sm:px-2.5 sm:text-[11px]">
          <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          {task.xp_value}
        </span>
      )}
    </div>
  )
}
