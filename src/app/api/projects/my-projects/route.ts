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
// Returns projects accessible to the authenticated user
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
      // fallback
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, departments')
      .eq('id', user.id)
      .single()

    const role = profile?.role || user.user_metadata?.role || 'member'
    const isAdmin = role === 'admin'

    // Fetch all active projects
    const { data: allProjects, error: allErr } = await adminClient
      .from('projects')
      .select('id, name, department')
      .order('name', { ascending: true })

    if (allErr) {
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    if (!allProjects || allProjects.length === 0) {
      return NextResponse.json(
        { projects: [] },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    // Admins have access to all projects
    if (isAdmin) {
      return NextResponse.json(
        { projects: allProjects },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    // Collect project IDs where user is member/assigned
    const userProjectIds = new Set<string>()

    // 1. Check Supabase project_members table
    try {
      const { data: pmData } = await adminClient
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      if (pmData) {
        for (const row of pmData) {
          if (row.project_id) userProjectIds.add(row.project_id)
        }
      }
    } catch {
      // ignore
    }

    // 2. Check task_assignees (2-step query for reliability without FK embedding)
    try {
      const { data: assignees } = await adminClient
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id)

      if (assignees && assignees.length > 0) {
        const taskIds = assignees.map((a: { task_id: string }) => a.task_id).filter(Boolean)
        const { data: tasks } = await adminClient
          .from('tasks')
          .select('project_id')
          .in('id', taskIds)

        if (tasks) {
          for (const t of tasks) {
            if (t.project_id) userProjectIds.add(t.project_id)
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Check tasks created by user
    try {
      const { data: createdTasks } = await adminClient
        .from('tasks')
        .select('project_id')
        .eq('created_by', user.id)

      if (createdTasks) {
        for (const t of createdTasks) {
          if (t.project_id) userProjectIds.add(t.project_id)
        }
      }
    } catch {
      // ignore
    }

    // 4. Check projectMembersStore (local json & roster tasks)
    try {
      const localMap = await getAllProjectMemberIds()
      for (const pid in localMap) {
        if (localMap[pid]?.includes(user.id)) {
          userProjectIds.add(pid)
        }
      }
    } catch {
      // ignore
    }

    // 5. Match by departments (for all users: members, mentors)
    const userDepts = new Set<string>()
    if (profile?.departments && Array.isArray(profile.departments)) {
      for (const d of profile.departments) {
        if (typeof d === 'string') userDepts.add(d)
        else if (d?.department) userDepts.add(d.department)
      }
    }
    if (user.user_metadata?.departments && Array.isArray(user.user_metadata.departments)) {
      for (const d of user.user_metadata.departments) {
        if (typeof d === 'string') userDepts.add(d)
        else if (d?.department) userDepts.add(d.department)
      }
    }

    if (userDepts.size > 0) {
      for (const p of allProjects) {
        if (p.department && userDepts.has(p.department)) {
          userProjectIds.add(p.id)
        }
      }

      try {
        const deptMap = await getAllProjectDepartmentsMap()
        for (const [pid, pDeps] of Object.entries(deptMap)) {
          if (pDeps.some((d) => userDepts.has(d))) {
            userProjectIds.add(pid)
          }
        }
      } catch {
        // ignore
      }
    }

    // 6. Final fallback: If user doesn't have an explicit assignment yet,
    // show available projects so they are never blocked from requesting XP
    let matchingProjects = allProjects.filter((p) => userProjectIds.has(p.id))
    if (matchingProjects.length === 0) {
      matchingProjects = allProjects
    }

    return NextResponse.json(
      { projects: matchingProjects },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای سرور در دریافت پروژه‌ها'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
