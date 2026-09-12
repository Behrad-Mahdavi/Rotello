import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Role, MemberDepartment } from '@/utils/database.types'

export const dynamic = 'force-dynamic'

// GET /api/admin/members - fetch all members with enriched user_metadata and email
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can access this resource' }, { status: 403 })
    }

    let profilesData: any[] = []
    let authUsers: any[] = []

    try {
      const adminClient = createAdminClient()
      const [profilesRes, usersRes] = await Promise.all([
        adminClient.from('profiles').select('*').order('created_at', { ascending: false }),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] } })),
      ])

      if (profilesRes.data) {
        profilesData = profilesRes.data
      }
      if (usersRes.data?.users) {
        authUsers = usersRes.data.users
      }
    } catch (adminErr) {
      console.warn('Admin client fallback to standard supabase client:', adminErr)
      // Fallback to standard client
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (data) profilesData = data
    }

    const authUsersMap = new Map<
      string,
      {
        email?: string
        role?: Role
        departments?: MemberDepartment[]
        avatar_url?: string | null
        full_name?: string
      }
    >()
    if (authUsers.length > 0) {
      for (const u of authUsers) {
        authUsersMap.set(u.id, {
          email: u.email,
          role: (u.user_metadata?.role as Role) || undefined,
          departments: (u.user_metadata?.departments as MemberDepartment[]) || undefined,
          avatar_url: (u.user_metadata?.avatar_url as string) || null,
          full_name: (u.user_metadata?.full_name as string) || undefined,
        })
      }
    }

    const enrichedMembers = profilesData.map((p) => {
      const authInfo = authUsersMap.get(p.id)
      // Prioritize auth metadata for role if DB check constraint hasn't been updated yet
      const role: Role = (authInfo?.role || p.role || 'member') as Role
      const departments: MemberDepartment[] = authInfo?.departments || p.departments || []
      const avatar_url = authInfo?.avatar_url || p.avatar_url || null
      const full_name = authInfo?.full_name || p.full_name || ''
      const email = authInfo?.email || ''

      return {
        ...p,
        full_name,
        role,
        departments,
        avatar_url,
        email,
      }
    })

    return NextResponse.json(
      { members: enrichedMembers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PATCH /api/admin/members - update an existing member's role, departments, and name
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can modify members' }, { status: 403 })
    }

    const { user_id, full_name, role, departments } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const validRoles: Role[] = ['admin', 'mentor', 'member']
    const finalRole: Role = validRoles.includes(role) ? role : 'member'

    // Clean departments array
    const validDeps = ['engineers', 'artists', 'generalists']
    const finalDepartments: MemberDepartment[] = Array.isArray(departments)
      ? departments
          .filter((d) => d && validDeps.includes(d.department) && (d.level === 'A' || d.level === 'B'))
          .map((d) => ({ department: d.department, level: d.level }))
      : []

    const adminClient = createAdminClient()

    // 1. Update auth.users user_metadata
    const updateAuthRes = await adminClient.auth.admin.updateUserById(user_id, {
      user_metadata: {
        ...(full_name ? { full_name } : {}),
        role: finalRole,
        departments: finalDepartments,
      },
    })

    if (updateAuthRes.error) {
      return NextResponse.json({ error: updateAuthRes.error.message }, { status: 400 })
    }

    // 2. Update profiles table (try with all fields; if role constraint or column is missing, fallback gracefully)
    const profileUpdateData: Record<string, unknown> = {}
    if (full_name) profileUpdateData.full_name = full_name
    profileUpdateData.role = finalRole
    profileUpdateData.departments = finalDepartments

    let profileError = null
    const { error: fullErr } = await adminClient
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', user_id)

    if (fullErr) {
      // If error was due to role constraint or departments column not yet added in SQL
      // retry updating only full_name and safe role
      const fallbackRole = finalRole === 'mentor' ? 'member' : finalRole
      const { error: fallbackErr } = await adminClient
        .from('profiles')
        .update({
          ...(full_name ? { full_name } : {}),
          role: fallbackRole,
        })
        .eq('id', user_id)
      profileError = fallbackErr
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    try {
      const { invalidateMembersCache } = await import('@/utils/membersCache')
      invalidateMembersCache()
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      member: {
        id: user_id,
        full_name,
        role: finalRole,
        departments: finalDepartments,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
