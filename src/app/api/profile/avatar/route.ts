import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

// Helper to upload base64 data to Supabase Storage bucket 'avatars'
async function uploadBase64ToStorage(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  base64String: string
): Promise<string | null> {
  try {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return null
    }

    const mimeType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const filePath = `${userId}.${ext}`

    // Ensure bucket exists
    try {
      await adminClient.storage.createBucket('avatars', { public: true })
    } catch {
      // Ignore if bucket already exists
    }

    const { error: uploadErr } = await adminClient.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      })

    if (uploadErr) {
      console.error('Error uploading avatar to storage:', uploadErr)
      return null
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (err) {
    console.error('Failed to process base64 avatar:', err)
    return null
  }
}

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
    const inputAvatarUrl = body.avatarUrl || null

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
    let finalAvatarUrl: string | null = inputAvatarUrl

    // If avatarUrl is a base64 string, upload to Supabase Storage and get short public URL!
    // NEVER store base64 in user_metadata because it blows up JWT size > 14KB causing Vercel 494!
    if (inputAvatarUrl && typeof inputAvatarUrl === 'string' && inputAvatarUrl.startsWith('data:image')) {
      const storageUrl = await uploadBase64ToStorage(adminClient, targetUserId, inputAvatarUrl)
      if (storageUrl) {
        finalAvatarUrl = storageUrl
      } else {
        return NextResponse.json(
          { error: 'خطا در بارگذاری تصویر به سرور ذخیره‌سازی' },
          { status: 500 }
        )
      }
    }

    // 1. Update user_metadata in Supabase Auth with the short URL
    const { data: existingUser } = await adminClient.auth.admin.getUserById(targetUserId)
    const existingMeta = existingUser?.user?.user_metadata || {}

    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...existingMeta,
        avatar_url: finalAvatarUrl,
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
        .update({ avatar_url: finalAvatarUrl })
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
      avatar_url: finalAvatarUrl,
      profileUpdated,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطای سرور در ذخیره عکس پروفایل'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
