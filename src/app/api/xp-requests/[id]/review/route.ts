import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { XpRequestAwardType } from '@/utils/database.types'

export const dynamic = 'force-dynamic'

// POST /api/xp-requests/[id]/review - Admin reviews (approves/rejects) an XP request
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'احراز هویت انجام نشده است.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'فقط راهبران مجاز به بررسی درخواست‌های امتیاز هستند.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      action,
      final_task_name,
      award_type,
      awarded_xp,
      target_user_ids,
      reviewer_note,
    } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'عملیات نامعتبر است (باید تایید یا رد باشد).' }, { status: 400 })
    }

    let adminClient = supabase
    try {
      adminClient = createAdminClient() as unknown as typeof supabase
    } catch {
      // fallback to session client
    }

    // 1. Fetch the existing request
    const { data: xpReq, error: fetchErr } = await adminClient
      .from('xp_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !xpReq) {
      return NextResponse.json({ error: 'درخواست مورد نظر یافت نشد.' }, { status: 404 })
    }

    if (xpReq.status !== 'pending') {
      return NextResponse.json({ error: 'این درخواست قبلاً تعیین وضعیت شده است.' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    // CASE 1: REJECT
    if (action === 'reject') {
      const trimmedNote = typeof reviewer_note === 'string' ? reviewer_note.trim() : null
      const { data: updatedReq, error: updateErr } = await adminClient
        .from('xp_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: nowIso,
          reviewer_note: trimmedNote,
          updated_at: nowIso,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (updateErr) {
        return NextResponse.json({ error: `خطا در رد درخواست: ${updateErr.message}` }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'درخواست با موفقیت رد شد.',
        request: updatedReq,
      })
    }

    // CASE 2: APPROVE
    if (!final_task_name || typeof final_task_name !== 'string' || !final_task_name.trim()) {
      return NextResponse.json({ error: 'ثبت عنوان/نام تسک توسط راهبر الزامی است.' }, { status: 400 })
    }

    const validAwardTypes: XpRequestAwardType[] = ['task_completion', 'reward']
    if (!validAwardTypes.includes(award_type)) {
      return NextResponse.json({ error: 'نوع امتیاز باید تکمیل تسک یا تشویقی باشد.' }, { status: 400 })
    }

    const xpAmount = Number(awarded_xp)
    if (isNaN(xpAmount) || xpAmount <= 0) {
      return NextResponse.json({ error: 'مقدار امتیاز باید یک عدد مثبت باشد.' }, { status: 400 })
    }

    if (!Array.isArray(target_user_ids) || target_user_ids.length === 0) {
      return NextResponse.json({ error: 'حداقل یک عضو برای اعطای امتیاز باید انتخاب شود.' }, { status: 400 })
    }

    // Filter valid UUID strings
    const validTargetUserIds = target_user_ids.filter(
      (uid): uid is string => typeof uid === 'string' && uid.trim().length > 0
    )

    if (validTargetUserIds.length === 0) {
      return NextResponse.json({ error: 'شناسه کاربران انتخاب‌شده نامعتبر است.' }, { status: 400 })
    }

    const trimmedTaskName = final_task_name.trim()
    const trimmedNote = typeof reviewer_note === 'string' ? reviewer_note.trim() : null

    // Update xp_requests status
    const { data: updatedReq, error: updateErr } = await adminClient
      .from('xp_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: nowIso,
        final_task_name: trimmedTaskName,
        award_type: award_type,
        awarded_xp: xpAmount,
        target_user_ids: validTargetUserIds,
        reviewer_note: trimmedNote,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateErr) {
      return NextResponse.json({ error: `خطا در تایید درخواست: ${updateErr.message}` }, { status: 500 })
    }

    // Award XP to all target members
    const awardErrors: string[] = []
    for (const memberId of validTargetUserIds) {
      try {
        // Fetch current XP
        const { data: prof, error: profErr } = await adminClient
          .from('profiles')
          .select('xp_total')
          .eq('id', memberId)
          .single()

        if (profErr || !prof) {
          awardErrors.push(`عضو با شناسه ${memberId} یافت نشد`)
          continue
        }

        const currentXp = Number(prof.xp_total) || 0
        const newXp = currentXp + xpAmount

        // 1. Update profiles table
        const { error: xpUpdateErr } = await adminClient
          .from('profiles')
          .update({ xp_total: newXp })
          .eq('id', memberId)

        if (xpUpdateErr) {
          awardErrors.push(`خطا در افزایش امتیاز کاربر ${memberId}: ${xpUpdateErr.message}`)
        }

        // 2. Insert into xp_adjustments history table
        const reasonText = award_type === 'reward'
          ? `تشویقی درخواستی: ${trimmedTaskName}`
          : `تکمیل تسک درخواستی: ${trimmedTaskName}`

        await adminClient
          .from('xp_adjustments')
          .insert({
            user_id: memberId,
            amount: xpAmount,
            reason: reasonText,
            type: award_type,
            created_by: user.id,
          })
      } catch (err: unknown) {
        awardErrors.push(`خطا برای کاربر ${memberId}: ${err instanceof Error ? err.message : 'نامشخص'}`)
      }
    }

    try {
      const { invalidateMembersCache } = await import('@/utils/membersCache')
      invalidateMembersCache()
    } catch {
      // silent
    }

    return NextResponse.json({
      success: true,
      message: `امتیاز (${xpAmount} XP) با موفقیت به ${validTargetUserIds.length} عضو اعطا شد.`,
      request: updatedReq,
      warnings: awardErrors.length > 0 ? awardErrors : undefined,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای سرور در بررسی درخواست' },
      { status: 500 }
    )
  }
}
