import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

// DELETE /api/xp-requests/[id] - Cancel/delete an XP request
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'احراز هویت انجام نشده است.' }, { status: 401 })
    }

    let dbClient = supabase
    try {
      dbClient = createAdminClient() as unknown as typeof supabase
    } catch {
      // standard client
    }

    // Fetch the request
    const { data: req, error: fetchError } = await dbClient
      .from('xp_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !req) {
      return NextResponse.json({ error: 'درخواست مورد نظر یافت نشد.' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || user.user_metadata?.role === 'admin'

    // Only owner of pending request or admin can delete
    if (!isAdmin && req.user_id !== user.id) {
      return NextResponse.json({ error: 'شما دسترسی حذف این درخواست را ندارید.' }, { status: 403 })
    }

    if (!isAdmin && req.status !== 'pending') {
      return NextResponse.json({ error: 'تنها درخواست‌های در انتظار بررسی قابل لغو هستند.' }, { status: 400 })
    }

    const { error: deleteError } = await dbClient
      .from('xp_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: `خطا در حذف درخواست: ${deleteError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'درخواست با موفقیت حذف شد.' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای سرور' },
      { status: 500 }
    )
  }
}
