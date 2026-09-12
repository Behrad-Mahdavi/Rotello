import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

// POST /api/profile/avatar - Upload or update avatar for current user or by admin
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
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

    // 1. Update user_metadata in Supabase Auth
    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      user_metadata: { avatar_url: avatarUrl },
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
