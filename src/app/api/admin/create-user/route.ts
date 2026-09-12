import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    // Verify caller is admin
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can create users' }, { status: 403 })
    }

    const { email, password, full_name, role = 'member', departments = [] } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, password, and full_name are required' }, { status: 400 })
    }

    const validRoles = ['admin', 'mentor', 'member']
    const finalRole = validRoles.includes(role) ? role : 'member'

    const validDeps = ['engineers', 'artists', 'generalists']
    const finalDepartments = Array.isArray(departments)
      ? departments
          .filter((d) => d && validDeps.includes(d.department) && (d.level === 'A' || d.level === 'B'))
          .map((d) => ({ department: d.department, level: d.level }))
      : []

    // Use admin client (service role) to create user
    const adminClient = createAdminClient()

    const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: finalRole, departments: finalDepartments },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Update profile with full_name, role, and departments
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name,
        role: finalRole,
        departments: finalDepartments,
      })
      .eq('id', authUser.user!.id)

    if (profileError) {
      // Fallback if role constraint or departments column not yet migrated
      const fallbackRole = finalRole === 'mentor' ? 'member' : finalRole
      await adminClient
        .from('profiles')
        .update({ full_name, role: fallbackRole })
        .eq('id', authUser.user!.id)
    }

    return NextResponse.json({ success: true, user_id: authUser.user!.id })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
