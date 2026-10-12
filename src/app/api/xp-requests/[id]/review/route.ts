import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAllProjectDepartmentsMap } from '@/utils/projectDepartmentsStore'
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

    const body = await request.json().catch(() => ({}))
    const {
      action,
      final_task_name,
      award_type,
      awarded_xp,
      target_user_ids,
      reviewer_note,
      project_id,
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

    // Fetch and validate all target profiles before making any changes
    const { data: targetProfiles, error: fetchProfilesErr } = await adminClient
      .from('profiles')
      .select('id, full_name, role, xp_total')
      .in('id', validTargetUserIds)

    if (fetchProfilesErr || !targetProfiles || targetProfiles.length === 0) {
      return NextResponse.json(
        { error: 'اعضای انتخاب‌شده در سیستم یافت نشدند.' },
        { status: 404 }
      )
    }

    // Verify all recipients are regular members (Admins and Mentors do not receive XP)
    const nonMember = targetProfiles.find((p) => p.role !== 'member')
    if (nonMember) {
      return NextResponse.json(
        {
          error: `امکان اعطای امتیاز به «${nonMember.full_name}» وجود ندارد؛ سیستم امتیاز (XP) منحصراً متعلق به اعضای عادی است و راهبران یا منتورها امتیاز دریافت نمی‌کنند.`,
        },
        { status: 400 }
      )
    }

    const trimmedTaskName = final_task_name.trim()
    const trimmedNote = typeof reviewer_note === 'string' ? reviewer_note.trim() : null

    // 1. Award XP to each target member and record adjustment
    for (const prof of targetProfiles) {
      const currentXp = Number(prof.xp_total) || 0
      const newXp = currentXp + xpAmount

      // Update profiles table
      const { error: profUpdateErr } = await adminClient
        .from('profiles')
        .update({ xp_total: newXp })
        .eq('id', prof.id)

      if (profUpdateErr) {
        return NextResponse.json(
          { error: `خطا در افزایش امتیاز کاربر ${prof.full_name}: ${profUpdateErr.message}` },
          { status: 500 }
        )
      }

      // Insert into xp_adjustments history table
      const reasonText = award_type === 'reward'
        ? `تشویقی درخواستی: ${trimmedTaskName}`
        : `تکمیل تسک درخواستی: ${trimmedTaskName}`

      const { error: adjustErr } = await adminClient
        .from('xp_adjustments')
        .insert({
          user_id: prof.id,
          amount: xpAmount,
          reason: reasonText,
          type: award_type,
          created_by: user.id,
        })

      if (adjustErr) {
        console.warn(`Warning: Could not insert xp_adjustment for user ${prof.id}:`, adjustErr.message)
      }
    }

    // 2. Update xp_requests status to approved
    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: nowIso,
      final_task_name: trimmedTaskName,
      award_type: award_type,
      awarded_xp: xpAmount,
      target_user_ids: validTargetUserIds,
      reviewer_note: trimmedNote,
      updated_at: nowIso,
    }

    if (project_id !== undefined) {
      updatePayload.project_id = typeof project_id === 'string' && project_id.trim() ? project_id.trim() : null
    }

    let { data: updatedReq, error: updateErr } = await adminClient
      .from('xp_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    // Defensive fallback: if project_id column does not exist yet
    if (updateErr && updatePayload.project_id && updateErr.message.includes('project_id')) {
      delete updatePayload.project_id
      const fallbackUpdate = await adminClient
        .from('xp_requests')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()
      updatedReq = fallbackUpdate.data
      updateErr = fallbackUpdate.error
    }

    if (updateErr) {
      return NextResponse.json({ error: `خطا در تعیین وضعیت درخواست: ${updateErr.message}` }, { status: 500 })
    }

    // 2.1. If award_type is 'task_completion' AND a project is selected, create a completed task in the project kanban
    const finalProjectId = (typeof project_id === 'string' && project_id.trim())
      ? project_id.trim()
      : (xpReq.project_id || null)

    if (award_type === 'task_completion' && finalProjectId) {
      try {
        const { data: createdTask, error: taskErr } = await adminClient
          .from('tasks')
          .insert({
            project_id: finalProjectId,
            title: trimmedTaskName,
            description: xpReq.description || (trimmedNote ? `یادداشت راهبر: ${trimmedNote}` : null),
            status: 'done',
            xp_value: xpAmount,
            xp_awarded: true,
            created_by: user.id,
            priority: 'normal',
            created_at: xpReq.created_at || nowIso,
            updated_at: nowIso,
          })
          .select('id')
          .single()

        if (!taskErr && createdTask) {
          const assigneesPayload = validTargetUserIds.map((uid) => ({
            task_id: createdTask.id,
            user_id: uid,
          }))
          await adminClient.from('task_assignees').insert(assigneesPayload)
        } else if (taskErr) {
          console.warn('Warning: Could not create completed task record in tasks table:', taskErr.message)
        }
      } catch (taskInsertCatch) {
        console.warn('Warning: Task insertion error:', taskInsertCatch)
      }
    }

    // 3. Invalidate server cache
    try {
      const { invalidateMembersCache } = await import('@/utils/membersCache')
      invalidateMembersCache()
    } catch {
      // silent
    }

    // 4. Enrich updated request for response
    let enrichedProject = null
    if (updatedReq?.project_id) {
      try {
        const [projRes, deptsMap] = await Promise.all([
          adminClient
            .from('projects')
            .select('id, name')
            .eq('id', updatedReq.project_id)
            .single(),
          getAllProjectDepartmentsMap(),
        ])
        if (projRes.data) {
          const pDeps = deptsMap[projRes.data.id] || []
          enrichedProject = {
            id: projRes.data.id,
            name: projRes.data.name,
            department: pDeps[0] || null,
          }
        }
      } catch {
        // ignore
      }
    }

    const finalResponseReq = {
      ...updatedReq,
      project: enrichedProject,
      target_profiles: targetProfiles.map((tp) => ({
        id: tp.id,
        full_name: tp.full_name,
        role: tp.role,
        avatar_url: ((tp as any).avatar_url as string | null) || null,
        xp_total: (Number(tp.xp_total) || 0) + xpAmount,
      })),
    }

    return NextResponse.json({
      success: true,
      message: `امتیاز (${xpAmount} XP) با موفقیت به ${validTargetUserIds.length} عضو اعطا شد.`,
      request: finalResponseReq,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای سرور در بررسی درخواست' },
      { status: 500 }
    )
  }
}
