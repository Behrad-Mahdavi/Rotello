import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAllProjectMemberIds } from '@/utils/projectMembersStore'
import { getAllProjectDepartmentsMap } from '@/utils/projectDepartmentsStore'
import type { DepartmentKey } from '@/constants/departments'

export const dynamic = 'force-dynamic'

export interface ProjectOption {
  id: string
  name: string
  department: string | null
}

// GET /api/projects/my-projects
// Returns projects accessible to the authenticated user:
// - Admin: All projects
// - Mentor: Projects matching their departments OR where they are a member
// - Regular member: Projects they are added to (in roster, task assignees, or matching departments)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'احراز هویت انجام نشده است.' }, { status: 401 })
    }

    let adminClient = supabase
    try {
      adminClient = createAdminClient() as unknown as typeof supabase
    } catch {
      // fallback to session client
    }

    // Get user profile (do NOT select departments because profiles.departments does not exist in schema)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || (user.user_metadata?.role as string) || 'member'
    const isAdmin = role === 'admin'

    // Get all projects from database
    const { data: allProjects, error: allErr } = await adminClient
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true })

    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    // Fetch department and member mapping
    const [deptsMap, localMembersMap] = await Promise.all([
      getAllProjectDepartmentsMap(),
      getAllProjectMemberIds(),
    ])

    const projectsList = allProjects || []

    // Helper to format project option
    const formatProject = (p: { id: string; name: string }): ProjectOption => {
      const pDeps = deptsMap[p.id] || []
      return {
        id: p.id,
        name: p.name,
        department: pDeps[0] || null,
      }
    }

    // Admin has access to all projects
    if (isAdmin) {
      return NextResponse.json(
        { projects: projectsList.map(formatProject), isAdmin: true },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    // Collect project IDs where user is a member
    const userProjectIds = new Set<string>()

    // 1. Check member map (from tasks, roster, and local backup)
    for (const [pid, memberIds] of Object.entries(localMembersMap)) {
      if (memberIds.includes(user.id)) {
        userProjectIds.add(pid)
      }
    }

    // 2. Direct task_assignees check
    try {
      const { data: assigneesData } = await adminClient
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id)

      if (assigneesData && assigneesData.length > 0) {
        const taskIds = assigneesData.map((a: { task_id: string }) => a.task_id)
        const { data: tasksData } = await adminClient
          .from('tasks')
          .select('project_id')
          .in('id', taskIds)

        if (tasksData) {
          for (const t of tasksData) {
            if (t.project_id) userProjectIds.add(t.project_id)
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Department matching for Mentors and Members (stored in user_metadata)
    const userDepartments: { department: DepartmentKey }[] =
      (user.user_metadata?.departments as { department: DepartmentKey }[]) || []
    const userDeptKeys = userDepartments
      .map((d) => d.department)
      .filter(Boolean)

    if (role === 'mentor' && userDeptKeys.length > 0) {
      for (const [pid, pDeps] of Object.entries(deptsMap)) {
        if (pDeps.some((d) => userDeptKeys.includes(d))) {
          userProjectIds.add(pid)
        }
      }
    }

    // Filter projects matching userProjectIds
    let matchedProjects = projectsList.filter((p) => userProjectIds.has(p.id))

    // Fallback: If user has a department matching a project, also include it
    if (matchedProjects.length === 0 && userDeptKeys.length > 0) {
      matchedProjects = projectsList.filter((p) => {
        const pDeps = deptsMap[p.id] || []
        return pDeps.some((d) => userDeptKeys.includes(d))
      })
    }

    return NextResponse.json(
      {
        projects: matchedProjects.map(formatProject),
        allProjects: projectsList.map(formatProject),
        isAdmin: false,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای سرور در دریافت پروژه‌ها'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
