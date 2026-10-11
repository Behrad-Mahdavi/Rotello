import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAllProjectMemberIds } from '@/utils/projectMembersStore'
import type { DepartmentKey } from '@/constants/departments'

export const dynamic = 'force-dynamic'

export interface ProjectOption {
  id: string
  name: string
  department: string | null
}

// GET /api/projects/my-projects
// Returns projects accessible to the authenticated user:
// - Regular member: ONLY projects they are added to (as project_members or task assignees)
// - Mentor: Projects matching their departments OR where they are a member
// - Admin: All projects
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

    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, departments')
      .eq('id', user.id)
      .single()

    const role = profile?.role || user.user_metadata?.role || 'member'

    const isAdmin = role === 'admin'

    if (isAdmin) {
      const { data: allProjects, error: allErr } = await adminClient
        .from('projects')
        .select('id, name, department')
        .order('name', { ascending: true })

      if (allErr) {
        return NextResponse.json({ error: allErr.message }, { status: 500 })
      }

      return NextResponse.json(
        { projects: allProjects || [] },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    // Collect project IDs where user is a member
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

    // 2. Check task_assignees
    try {
      const { data: assigneesData } = await adminClient
        .from('task_assignees')
        .select('task_id, tasks(project_id)')
        .eq('user_id', user.id)

      if (assigneesData) {
        for (const item of assigneesData as unknown as { tasks?: { project_id: string } | { project_id: string }[] | null }[]) {
          const t = Array.isArray(item.tasks) ? item.tasks[0] : item.tasks
          if (t?.project_id) {
            userProjectIds.add(t.project_id)
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback / merge local store
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

    // 4. If Mentor, also include department matching projects
    if (role === 'mentor' && profile?.departments && Array.isArray(profile.departments)) {
      const mentorDeps = profile.departments
        .map((d: { department: DepartmentKey }) => d.department)
        .filter(Boolean)

      if (mentorDeps.length > 0) {
        try {
          const { data: depProjects } = await adminClient
            .from('projects')
            .select('id, department')
            .in('department', mentorDeps)

          if (depProjects) {
            for (const p of depProjects) {
              userProjectIds.add(p.id)
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (userProjectIds.size === 0) {
      return NextResponse.json(
        { projects: [] },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    const { data: projectsData, error: projErr } = await adminClient
      .from('projects')
      .select('id, name, department')
      .in('id', Array.from(userProjectIds))
      .order('name', { ascending: true })

    if (projErr) {
      return NextResponse.json({ error: projErr.message }, { status: 500 })
    }

    return NextResponse.json(
      { projects: projectsData || [] },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای سرور در دریافت پروژه‌ها'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
