import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Role, MemberDepartment, Profile } from '@/utils/database.types'

import { getCachedMembers, setCachedMembers } from '@/utils/membersCache'

async function getEnrichedMembers(): Promise<Profile[]> {
  const cached = getCachedMembers()
  if (cached) {
    return cached
  }

  const adminClient = createAdminClient()
  const [profilesRes, usersRes] = await Promise.all([
    adminClient.from('profiles').select('*').order('xp_total', { ascending: false }),
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  if (profilesRes.error) {
    throw new Error(profilesRes.error.message)
  }

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

  const enriched: Profile[] = (profilesRes.data || []).map((p) => {
    const authInfo = authUsersMap.get(p.id)
    const role: Role = (authInfo?.role || p.role || 'member') as Role
    const departments: MemberDepartment[] = authInfo?.departments || p.departments || []
    const avatar_url = authInfo?.avatar_url || p.avatar_url || null
    const full_name = authInfo?.full_name || p.full_name || ''

    return {
      ...p,
      full_name,
      role,
      departments,
      avatar_url,
    }
  })

  setCachedMembers(enriched)

  return enriched
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser()

    let user = cookieUser
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        if (token && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
          user = { id: 'service-role', email: 'service@supabase.co' } as unknown as typeof cookieUser
        } else {
          const adminClient = createAdminClient()
          const { data: tokenUser } = await adminClient.auth.getUser(token)
          user = tokenUser?.user || null
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('id')
    const roleFilter = searchParams.get('role')

    if (targetId) {
      // 1. Fast cache check
      const cached = getCachedMembers()
      if (cached) {
        const found = cached.find((m) => m.id === targetId)
        if (found) {
          return NextResponse.json({ member: found })
        }
      }

      // 2. Direct single user lookup
      const adminClient = createAdminClient()
      const [profileRes, userRes] = await Promise.all([
        adminClient.from('profiles').select('*').eq('id', targetId).single(),
        adminClient.auth.admin.getUserById(targetId).catch(() => ({ data: null })),
      ])

      if (!profileRes.data) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }

      const authUser = userRes.data?.user
      const role: Role = (authUser?.user_metadata?.role || profileRes.data.role || 'member') as Role
      const departments: MemberDepartment[] = authUser?.user_metadata?.departments || profileRes.data.departments || []
      const avatar_url = authUser?.user_metadata?.avatar_url || profileRes.data.avatar_url || null
      const full_name = authUser?.user_metadata?.full_name || profileRes.data.full_name || ''

      return NextResponse.json({
        member: {
          ...profileRes.data,
          full_name,
          role,
          departments,
          avatar_url,
        },
      })
    }

    const members = await getEnrichedMembers()

    let filtered = members
    if (roleFilter) {
      filtered = filtered.filter((m) => m.role === roleFilter)
    }

    return NextResponse.json({ members: filtered })
  } catch (err: unknown) {
    console.error('Error in /api/members:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
