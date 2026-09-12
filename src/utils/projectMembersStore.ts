import fs from 'fs'
import path from 'path'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCachedMembers } from '@/utils/membersCache'
import type { Profile, Role, MemberDepartment } from '@/utils/database.types'

export const ROSTER_TASK_TITLE = '__PROJECT_ROSTER__'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE_PATH = path.join(DATA_DIR, 'project_members.json')

function readLocalMembers(): Record<string, string[]> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8')
      return {}
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeLocalMembers(data: Record<string, string[]>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch {
    // Ignore fs errors in serverless/readonly environments
  }
}

async function getAllProfiles(): Promise<Profile[]> {
  const cached = getCachedMembers()
  if (cached) return cached

  const admin = createAdminClient()
  const [profilesRes, usersRes] = await Promise.all([
    admin.from('profiles').select('*').order('xp_total', { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const authUsersMap = new Map<
    string,
    {
      role?: Role
      departments?: MemberDepartment[]
      avatar_url?: string | null
      full_name?: string
    }
  >()

  if (usersRes.data?.users) {
    for (const u of usersRes.data.users) {
      authUsersMap.set(u.id, {
        role: (u.user_metadata?.role as Role) || undefined,
        departments: (u.user_metadata?.departments as MemberDepartment[]) || undefined,
        avatar_url: (u.user_metadata?.avatar_url as string) || null,
        full_name: (u.user_metadata?.full_name as string) || undefined,
      })
    }
  }

  return (profilesRes.data || []).map((p) => {
    const authInfo = authUsersMap.get(p.id)
    return {
      ...p,
      full_name: authInfo?.full_name || p.full_name || '',
      role: (authInfo?.role || p.role || 'member') as Role,
      departments: authInfo?.departments || p.departments || [],
      avatar_url: authInfo?.avatar_url || p.avatar_url || null,
    }
  })
}

/**
 * Ensures a project has a roster task in Supabase to persist explicit project member associations.
 */
async function getOrCreateRosterTask(projectId: string): Promise<string | null> {
  const admin = createAdminClient()
  try {
    // 1. Check if roster task already exists
    const { data: existing } = await admin
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('title', ROSTER_TASK_TITLE)
      .limit(1)

    if (existing && existing.length > 0) {
      return existing[0].id
    }

    // 2. Find a valid creator user (project creator or admin profile)
    const { data: proj } = await admin
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()

    let creatorId = proj?.created_by
    if (!creatorId) {
      const { data: adminProf } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()
      creatorId = adminProf?.id
    }

    if (!creatorId) return null

    const { data: inserted, error } = await admin
      .from('tasks')
      .insert({
        project_id: projectId,
        title: ROSTER_TASK_TITLE,
        description: 'سیستمی: لیست اعضای این پروژه',
        status: 'backlog',
        priority: 'normal',
        xp_value: 0,
        xp_awarded: false,
        created_by: creatorId,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('Error creating roster task:', error)
      return null
    }

    return inserted.id
  } catch (err) {
    console.error('Error in getOrCreateRosterTask:', err)
    return null
  }
}

/**
 * Get all member profiles assigned to a project.
 */
export async function getProjectMembers(projectId: string): Promise<Profile[]> {
  const admin = createAdminClient()
  const memberIdSet = new Set<string>()

  // 1. Try Supabase project_members table if available
  try {
    const { data, error } = await admin
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (!error && data) {
      data.forEach((r: { user_id: string }) => memberIdSet.add(r.user_id))
    }
  } catch {
    // Ignore if table not present
  }

  // 2. Query task_assignees for all tasks belonging to this project (including ROSTER task)
  try {
    const { data: tasks } = await admin
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t: { id: string }) => t.id)
      const { data: assignees } = await admin
        .from('task_assignees')
        .select('user_id')
        .in('task_id', taskIds)

      if (assignees) {
        assignees.forEach((a: { user_id: string }) => memberIdSet.add(a.user_id))
      }
    }
  } catch (err) {
    console.error('Error fetching tasks/assignees for project:', err)
  }

  // 3. Fallback / merge with local JSON store
  try {
    const local = readLocalMembers()
    if (local[projectId]) {
      local[projectId].forEach((id) => memberIdSet.add(id))
    }
  } catch {
    // Ignore
  }

  // 4. Fetch enriched profiles
  const allProfiles = await getAllProfiles()
  const profileMap = new Map(allProfiles.map((p) => [p.id, p]))

  const result: Profile[] = []
  for (const id of Array.from(memberIdSet)) {
    const prof = profileMap.get(id)
    if (prof) {
      result.push(prof)
    } else {
      result.push({
        id,
        full_name: 'کاربر',
        role: 'member',
        xp_total: 0,
        created_at: '',
      })
    }
  }

  return result
}

/**
 * Add a member to a project.
 */
export async function addProjectMember(projectId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()

  // 1. Try Supabase project_members table
  try {
    await admin
      .from('project_members')
      .insert({ project_id: projectId, user_id: userId })
  } catch {
    // Ignore
  }

  // 2. Persist in Supabase task_assignees via the roster task
  try {
    const rosterTaskId = await getOrCreateRosterTask(projectId)
    if (rosterTaskId) {
      // Check if already assigned
      const { data: existing } = await admin
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', rosterTaskId)
        .eq('user_id', userId)
        .limit(1)

      if (!existing || existing.length === 0) {
        await admin
          .from('task_assignees')
          .insert({ task_id: rosterTaskId, user_id: userId })
      }
    }
  } catch (err) {
    console.error('Error assigning member to roster task:', err)
  }

  // 3. Sync to local store backup
  try {
    const local = readLocalMembers()
    const existing = local[projectId] || []
    if (!existing.includes(userId)) {
      local[projectId] = [...existing, userId]
      writeLocalMembers(local)
    }
  } catch {
    // Ignore
  }

  return true
}

/**
 * Remove a member from a project.
 */
export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()

  // 1. Try Supabase project_members table
  try {
    await admin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
  } catch {
    // Ignore
  }

  // 2. Remove member from roster task and project tasks
  try {
    const { data: tasks } = await admin
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t: { id: string }) => t.id)
      await admin
        .from('task_assignees')
        .delete()
        .eq('user_id', userId)
        .in('task_id', taskIds)
    }
  } catch (err) {
    console.error('Error removing member from task_assignees:', err)
  }

  // 3. Remove from local store backup
  try {
    const local = readLocalMembers()
    if (local[projectId]) {
      local[projectId] = local[projectId].filter((id) => id !== userId)
      writeLocalMembers(local)
    }
  } catch {
    // Ignore
  }

  return true
}

/**
 * Get member IDs for all projects in bulk (useful for project listing and cards).
 */
export async function getAllProjectMemberIds(): Promise<Record<string, string[]>> {
  const admin = createAdminClient()
  const map: Record<string, Set<string>> = {}

  // 1. Query projects, tasks, and task_assignees to derive all members reliably
  try {
    const [projectsRes, tasksRes, assigneesRes] = await Promise.all([
      admin.from('projects').select('id'),
      admin.from('tasks').select('id, project_id'),
      admin.from('task_assignees').select('task_id, user_id'),
    ])

    if (projectsRes.data) {
      projectsRes.data.forEach((p: { id: string }) => {
        map[p.id] = new Set()
      })
    }

    const tMap = new Map<string, string>()
    if (tasksRes.data) {
      tasksRes.data.forEach((t: { id: string; project_id: string }) => {
        tMap.set(t.id, t.project_id)
      })
    }

    if (assigneesRes.data) {
      assigneesRes.data.forEach((a: { task_id: string; user_id: string }) => {
        const pid = tMap.get(a.task_id)
        if (pid) {
          if (!map[pid]) map[pid] = new Set()
          map[pid].add(a.user_id)
        }
      })
    }
  } catch (err) {
    console.error('Error querying tasks & assignees in getAllProjectMemberIds:', err)
  }

  // 2. Try Supabase project_members table if present
  try {
    const { data, error } = await admin
      .from('project_members')
      .select('project_id, user_id')

    if (!error && data) {
      for (const row of data) {
        if (!map[row.project_id]) map[row.project_id] = new Set()
        map[row.project_id].add(row.user_id)
      }
    }
  } catch {
    // Ignore
  }

  // 3. Merge local store backup
  try {
    const local = readLocalMembers()
    for (const pid in local) {
      if (!map[pid]) map[pid] = new Set()
      local[pid].forEach((id) => map[pid].add(id))
    }
  } catch {
    // Ignore
  }

  // Convert Sets to arrays
  const result: Record<string, string[]> = {}
  for (const pid in map) {
    result[pid] = Array.from(map[pid])
  }

  return result
}
