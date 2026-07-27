export type Role = 'admin' | 'member'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'normal' | 'important' | 'urgent'

export interface Profile {
  id: string
  full_name: string
  role: Role
  xp_total: number
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  deadline: string | null
  created_by: string
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  deadline: string | null
  status: TaskStatus
  priority: TaskPriority
  xp_value: number
  xp_awarded: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface TaskAssignee {
  task_id: string
  user_id: string
  assigned_at: string
}

export interface Checklist {
  id: string
  task_id: string
  title: string
  sort_order: number
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  content: string
  is_done: boolean
  done_by: string | null
  done_at: string | null
  sort_order: number
}

export interface TaskReport {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
}

export type TaskWithRelations = Task & {
  assignees: (TaskAssignee & { profile: Pick<Profile, 'id' | 'full_name'> })[]
  checklists: (Checklist & { items: ChecklistItem[] })[]
}
