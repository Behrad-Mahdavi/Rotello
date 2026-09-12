import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

// POST /api/profile/avatar - Upload or update avatar for current user or by admin
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: cookieUser } } = await supabase.auth.getUser()

    let user = cookieUser
    if (!user) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        if (token && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
          user = { id: 'service-role', user_metadata: { role: 'admin' } } as unknown as typeof cookieUser
        } else {
          const adminClient = createAdminClient()
          const { data: tokenUser } = await adminClient.auth.getUser(token)
          user = tokenUser?.user || null
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'احراز هویت نشده‌اید.' }, { status: 401 })
    }

    const body = await request.json()
    const targetUserId = body.userId || user.id
    const avatarUrl = body.avatarUrl || null

    // Check permissions: user can update own avatar, admin can update anyone's
    const isAdmin = user.user_metadata?.role === 'admin'
    if (targetUserId !== user.id && !isAdmin) {
      // Check if user has admin role in profiles table
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') {
        return NextResponse.json({ error: 'دسترسی غیرمجاز.' }, { status: 403 })
      }
    }

    const adminClient = createAdminClient()

    // 1. Update user_metadata in Supabase Auth (preserving existing metadata)
    const { data: existingUser } = await adminClient.auth.admin.getUserById(targetUserId)
    const existingMeta = existingUser?.user?.user_metadata || {}

    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...existingMeta,
        avatar_url: avatarUrl,
      },
    })

    if (authErr) {
      console.error('Error updating user auth metadata:', authErr)
    }

    // 2. Try updating public.profiles table (catch gracefully if avatar_url column does not exist)
    let profileUpdated = false
    try {
      const { error: profileErr } = await adminClient
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', targetUserId)

      if (!profileErr) {
        profileUpdated = true
      }
    } catch {
      // Ignore schema column error
    }

    try {
      const { invalidateMembersCache } = await import('@/utils/membersCache')
      invalidateMembersCache()
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
      profileUpdated,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطای سرور در ذخیره عکس پروفایل'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
