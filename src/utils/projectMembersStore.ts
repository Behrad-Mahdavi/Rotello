import fs from 'fs'
import path from 'path'
import { createAdminClient } from '@/utils/supabase/admin'
import { getCachedMembers } from '@/utils/membersCache'
import type { Profile, Role, MemberDepartment } from '@/utils/database.types'

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
  } catch (err) {
    console.error('Error reading local project_members.json:', err)
    return {}
  }
}

function writeLocalMembers(data: Record<string, string[]>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing local project_members.json:', err)
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
 * Get all member profiles assigned to a project.
 */
export async function getProjectMembers(projectId: string): Promise<Profile[]> {
  const admin = createAdminClient()
  let memberIds: string[] = []
  let tableAvailable = false

  // 1. Try Supabase project_members table
  try {
    const { data, error } = await admin
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)

    if (!error && data) {
      tableAvailable = true
      memberIds = data.map((r: { user_id: string }) => r.user_id)
    }
  } catch {
    tableAvailable = false
  }

  // 2. Fallback to local JSON store if table not available
  if (!tableAvailable) {
    const local = readLocalMembers()
    if (local[projectId]) {
      memberIds = local[projectId]
    } else {
      // 3. Backward compatibility: if project has no members recorded yet,
      // seed it from task_assignees of this project's tasks
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

          if (assignees && assignees.length > 0) {
            const uniqueIds = Array.from(new Set(assignees.map((a: { user_id: string }) => a.user_id)))
            memberIds = uniqueIds
            local[projectId] = uniqueIds
            writeLocalMembers(local)
          }
        }
      } catch (err) {
        console.error('Error fetching fallback task assignees for project:', err)
      }
    }
  }

  // 4. Fetch enriched profiles
  const allProfiles = await getAllProfiles()
  const profileMap = new Map(allProfiles.map((p) => [p.id, p]))

  const result: Profile[] = []
  for (const id of memberIds) {
    const prof = profileMap.get(id)
    if (prof) {
      result.push(prof)
    } else {
      // Basic fallback if profile not found
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
  let success = false

  // 1. Try Supabase table
  try {
    const { error } = await admin
      .from('project_members')
      .insert({ project_id: projectId, user_id: userId })

    if (!error) {
      success = true
    }
  } catch {
    // Ignore table failure, will use local
  }

  // 2. Always sync to local store
  const local = readLocalMembers()
  const existing = local[projectId] || []
  if (!existing.includes(userId)) {
    local[projectId] = [...existing, userId]
    writeLocalMembers(local)
  }

  return true
}

/**
 * Remove a member from a project.
 */
export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()

  // 1. Try Supabase table
  try {
    await admin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
  } catch {
    // Ignore
  }

  // 2. Remove from local store
  const local = readLocalMembers()
  if (local[projectId]) {
    local[projectId] = local[projectId].filter((id) => id !== userId)
    writeLocalMembers(local)
  }

  return true
}

/**
 * Get member IDs for all projects in bulk (useful for project listing).
 */
export async function getAllProjectMemberIds(): Promise<Record<string, string[]>> {
  const admin = createAdminClient()
  const map: Record<string, string[]> = {}

  // 1. Try Supabase table
  try {
    const { data, error } = await admin
      .from('project_members')
      .select('project_id, user_id')

    if (!error && data) {
      for (const row of data) {
        if (!map[row.project_id]) map[row.project_id] = []
        map[row.project_id].push(row.user_id)
      }
      return map
    }
  } catch {
    // Ignore
  }

  // 2. Fallback to local store
  return readLocalMembers()
}
