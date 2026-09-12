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
  backlog: 'border-r-slate-400 dark:border-r-slate-500',
  todo: 'border-r-[#202A5A] dark:border-r-blue-400',
  in_progress: 'border-r-[#4DA59A] dark:border-r-[#59BBAF]',
  review: 'border-r-[#F8A41D]',
  done: 'border-r-[#652D90] dark:border-r-[#A78BFA]',
}

const PRIORITY_BADGE: Record<string, string> = {
  normal: 'bg-[#202A5A]/10 text-[#202A5A] dark:bg-blue-500/15 dark:text-blue-300',
  important: 'bg-[#F8A41D]/15 text-[#B45309] dark:text-amber-300',
  urgent: 'bg-[#E0195B]/15 text-[#E0195B] dark:text-rose-300',
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
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...(canDrag ? listeners : {})} 
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border border-border bg-surface p-3 transition-all duration-200 hover:shadow-md hover:border-action/40 ${STATUS_BORDER[task.status]} border-r-[3px] ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      } ${task.status === 'done' ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start gap-2">
        {canDrag && (
          <span className="mt-0.5 shrink-0 text-muted/30 group-hover:text-muted/70 transition-colors">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM8 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM8 22a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
            </svg>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold leading-snug text-default group-hover:text-action transition-colors">
            {task.title}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              task.status === 'done' ? 'bg-[#652D90]/10 text-[#652D90] dark:bg-purple-500/20 dark:text-purple-300' :
              task.status === 'review' ? 'bg-[#F8A41D]/15 text-[#B45309] dark:text-amber-300' :
              task.status === 'in_progress' ? 'bg-[#4DA59A]/15 text-[#2E7A71] dark:bg-[#59BBAF]/20 dark:text-[#7FD3C8]' :
              task.status === 'todo' ? 'bg-[#202A5A]/10 text-[#202A5A] dark:bg-blue-500/15 dark:text-blue-300' :
              'bg-slate-500/10 text-slate-600 dark:text-slate-400'
            }`}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {task.xp_value > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {task.xp_value} XP
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
