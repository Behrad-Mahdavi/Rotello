export type Role = 'admin' | 'mentor' | 'member'

export type DepartmentKey = 'engineers' | 'artists' | 'generalists'
export type DepartmentLevel = 'A' | 'B'

export interface MemberDepartment {
  department: DepartmentKey
  level: DepartmentLevel
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'

export type TaskPriority = 'normal' | 'important' | 'urgent'

export interface Profile {
  id: string
  full_name: string
  role: Role
  xp_total: number
  created_at: string
  departments?: MemberDepartment[]
  email?: string
  avatar_url?: string | null
}

export interface Project {
  id: string
  name: string
  description: string | null
  deadline: string | null
  department?: DepartmentKey | null
  created_by: string
  created_at: string
}

export interface ProjectMember {
  id?: string
  project_id: string
  user_id: string
  role?: string
  created_at?: string
  profile?: Profile
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

export type EventStatus = 'planning' | 'ready' | 'in_progress' | 'completed' | 'cancelled'

export interface Event {
  id: string
  title: string
  description: string | null
  event_date: string | null
  location: string | null
  target_audience: string | null
  lead_id: string
  status: EventStatus
  created_at: string
  updated_at: string
}

export interface EventChecklistItem {
  id: string
  event_id: string
  category_key: string
  category_title: string
  title: string
  is_done: boolean
  notes: string | null
  assignee_id: string | null
  done_by: string | null
  done_at: string | null
  sort_order: number
  created_at: string
}

export interface EventChecklistItemWithRelations extends EventChecklistItem {
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
  done_by_user?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface EventWithRelations extends Event {
  lead?: Pick<Profile, 'id' | 'full_name'> | null
  items?: EventChecklistItemWithRelations[]
}

export type XpAdjustmentType = 'penalty' | 'reward' | 'task_completion' | 'task_reversal'

export interface XpAdjustment {
  id: string
  user_id: string
  amount: number
  reason: string
  type: XpAdjustmentType
  created_by: string | null
  created_at: string
  creator?: Pick<Profile, 'id' | 'full_name'> | null
}


