/**
 * POST /api/muse/xp-requests/[id]/review
 *
 * Muse-agent endpoint — approve or reject a pending XP request.
 * Auth: Bearer MUSE_API_TOKEN (env var, timingSafeEqual)
 *
 * Body: {
 *   action           : 'approve' | 'reject'
 *   final_task_name  : string          (required when approve)
 *   award_type       : 'task_completion' | 'reward'  (required when approve)
 *   awarded_xp       : number          (1 – 1000, required when approve)
 *   target_user_ids  : string[]        (required when approve)
 *   reviewer_note    : string | null   (optional)
 *   project_id       : string | null   (optional)
 * }
 *
 * On approve:
 *   - Validates award_type, XP cap (MUSE_MAX_XP = 1000), all targets are 'member' role
 *   - Updates profiles.xp_total for each target
 *   - Inserts xp_adjustments rows with reviewed_by = MUSE_ADMIN_USER_ID (real UUID)
 *   - Marks xp_requests.status = 'approved'
 *   - If award_type === 'task_completion' and project_id present, inserts a 'done' task
 *
 * Does NOT call move_task_status RPC.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAllProjectDepartmentsMap } from '@/utils/projectDepartmentsStore'
import { verifyMuseToken, getMuseAdminId, MUSE_MAX_XP } from '@/app/api/muse/_auth'
import type { XpRequestAwardType } from '@/utils/database.types'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tag = '[muse/xp-requests/:id/review POST]'
  const start = Date.now()

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    if (!verifyMuseToken(request.headers.get('Authorization'))) {
      console.warn(`${tag} 401 – invalid or missing token  ip=${
        request.headers.get('x-forwarded-for') ?? 'unknown'
      }`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Muse admin identity (real UUID, used in reviewed_by / created_by) ───
    const museAdminId = await getMuseAdminId()
    if (!museAdminId) {
      console.error(`${tag} MUSE_ADMIN_USER_ID is not configured and no admin profile found`)
      return NextResponse.json(
        { error: 'Muse admin identity is not configured. Set MUSE_ADMIN_USER_ID.' },
        { status: 503 }
      )
    }

    const { id } = await params

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

    console.log(`${tag} id=${id} action=${action} award_type=${award_type} xp=${awarded_xp} targets=${JSON.stringify(target_user_ids)}`)

    // ── Basic action validation ───────────────────────────────────────────────
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'عملیات نامعتبر است (باید approve یا reject باشد).' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // ── Fetch the existing request ───────────────────────────────────────────
    const { data: xpReq, error: fetchErr } = await admin
      .from('xp_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !xpReq) {
      console.warn(`${tag} request not found: ${id}`)
      return NextResponse.json({ error: 'درخواست مورد نظر یافت نشد.' }, { status: 404 })
    }

    if (xpReq.status !== 'pending') {
      console.warn(`${tag} request ${id} already has status=${xpReq.status}`)
      return NextResponse.json(
        { error: 'این درخواست قبلاً تعیین وضعیت شده است.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    // ════════════════════════════════════════════════════════════════════════
    // CASE 1: REJECT
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'reject') {
      const trimmedNote = typeof reviewer_note === 'string' ? reviewer_note.trim() : null

      const { data: updatedReq, error: updateErr } = await admin
        .from('xp_requests')
        .update({
          status: 'rejected',
          reviewed_by: museAdminId,
          reviewed_at: nowIso,
          reviewer_note: trimmedNote,
          updated_at: nowIso,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (updateErr) {
        console.error(`${tag} reject update error:`, updateErr.message)
        return NextResponse.json(
          { error: `خطا در رد درخواست: ${updateErr.message}` },
          { status: 500 }
        )
      }

      console.log(`${tag} rejected  id=${id}  ms=${Date.now() - start}`)
      return NextResponse.json({
        success: true,
        message: 'درخواست با موفقیت رد شد.',
        request: updatedReq,
      })
    }

    // ════════════════════════════════════════════════════════════════════════
    // CASE 2: APPROVE
    // ════════════════════════════════════════════════════════════════════════

    // Validate final_task_name
    if (!final_task_name || typeof final_task_name !== 'string' || !final_task_name.trim()) {
      return NextResponse.json(
        { error: 'ثبت عنوان/نام تسک توسط راهبر الزامی است.' },
        { status: 400 }
      )
    }

    // Validate award_type
    const validAwardTypes: XpRequestAwardType[] = ['task_completion', 'reward']
    if (!validAwardTypes.includes(award_type as XpRequestAwardType)) {
      return NextResponse.json(
        { error: 'نوع امتیاز باید task_completion یا reward باشد.' },
        { status: 400 }
      )
    }

    // Validate & cap awarded_xp
    const xpAmount = Number(awarded_xp)
    if (isNaN(xpAmount) || xpAmount <= 0) {
      return NextResponse.json(
        { error: 'مقدار امتیاز باید یک عدد مثبت باشد.' },
        { status: 400 }
      )
    }
    if (xpAmount > MUSE_MAX_XP) {
      return NextResponse.json(
        { error: `مقدار امتیاز نمی‌تواند بیشتر از ${MUSE_MAX_XP} باشد.` },
        { status: 400 }
      )
    }

    // Validate target_user_ids
    if (!Array.isArray(target_user_ids) || target_user_ids.length === 0) {
      return NextResponse.json(
        { error: 'حداقل یک عضو برای اعطای امتیاز باید انتخاب شود.' },
        { status: 400 }
      )
    }

    const validTargetUserIds = target_user_ids.filter(
      (uid): uid is string => typeof uid === 'string' && uid.trim().length > 0
    )

    if (validTargetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'شناسه کاربران انتخاب‌شده نامعتبر است.' },
        { status: 400 }
      )
    }

    // ── Fetch and validate target profiles ───────────────────────────────────
    const { data: targetProfiles, error: fetchProfilesErr } = await admin
      .from('profiles')
      .select('id, full_name, role, xp_total')
      .in('id', validTargetUserIds)

    if (fetchProfilesErr || !targetProfiles || targetProfiles.length === 0) {
      return NextResponse.json(
        { error: 'اعضای انتخاب‌شده در سیستم یافت نشدند.' },
        { status: 404 }
      )
    }

    // All targets must be regular members (admins and mentors do not receive XP)
    const nonMember = targetProfiles.find((p) => p.role !== 'member')
    if (nonMember) {
      return NextResponse.json(
        {
          error: `امکان اعطای امتیاز به «${nonMember.full_name}» وجود ندارد؛ سیستم امتیاز (XP) منحصراً متعلق به اعضای عادی است.`,
        },
        { status: 400 }
      )
    }

    const trimmedTaskName = final_task_name.trim()
    const trimmedNote = typeof reviewer_note === 'string' ? reviewer_note.trim() : null
    const reasonText =
      award_type === 'reward'
        ? `تشویقی درخواستی: ${trimmedTaskName}`
        : `تکمیل تسک درخواستی: ${trimmedTaskName}`

    // ── Award XP to each target member ───────────────────────────────────────
    for (const prof of targetProfiles) {
      const currentXp = Number(prof.xp_total) || 0
      const newXp = currentXp + xpAmount

      const { error: profUpdateErr } = await admin
        .from('profiles')
        .update({ xp_total: newXp })
        .eq('id', prof.id)

      if (profUpdateErr) {
        console.error(`${tag} profile update error for ${prof.id}:`, profUpdateErr.message)
        return NextResponse.json(
          { error: `خطا در افزایش امتیاز کاربر ${prof.full_name}: ${profUpdateErr.message}` },
          { status: 500 }
        )
      }

      const { error: adjustErr } = await admin.from('xp_adjustments').insert({
        user_id: prof.id,
        amount: xpAmount,
        reason: reasonText,
        type: award_type,
        created_by: museAdminId,  // ← real UUID, not 'service-role'
      })

      if (adjustErr) {
        console.warn(`${tag} xp_adjustment insert warning for ${prof.id}:`, adjustErr.message)
      }
    }

    // ── Update xp_requests status to approved ────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      reviewed_by: museAdminId,  // ← real UUID
      reviewed_at: nowIso,
      final_task_name: trimmedTaskName,
      award_type: award_type,
      awarded_xp: xpAmount,
      target_user_ids: validTargetUserIds,
      reviewer_note: trimmedNote,
      updated_at: nowIso,
    }

    const resolvedProjectId =
      typeof project_id === 'string' && project_id.trim() ? project_id.trim() : (xpReq.project_id ?? null)

    if (resolvedProjectId !== undefined) {
      updatePayload.project_id = resolvedProjectId
    }

    let { data: updatedReq, error: updateErr } = await admin
      .from('xp_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    // Defensive fallback if project_id column not yet in DB
    if (updateErr && resolvedProjectId && updateErr.message.includes('project_id')) {
      delete updatePayload.project_id
      const fallback = await admin
        .from('xp_requests')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()
      updatedReq = fallback.data
      updateErr = fallback.error
    }

    if (updateErr) {
      console.error(`${tag} approve update error:`, updateErr.message)
      return NextResponse.json(
        { error: `خطا در تعیین وضعیت درخواست: ${updateErr.message}` },
        { status: 500 }
      )
    }

    // ── If task_completion + project, create a 'done' task in Kanban ─────────
    if (award_type === 'task_completion' && resolvedProjectId) {
      try {
        const { data: createdTask, error: taskErr } = await admin
          .from('tasks')
          .insert({
            project_id: resolvedProjectId,
            title: trimmedTaskName,
            description:
              xpReq.description ||
              (trimmedNote ? `یادداشت راهبر: ${trimmedNote}` : null),
            status: 'done',
            xp_value: xpAmount,
            xp_awarded: true,
            created_by: museAdminId,  // ← real UUID
            priority: 'normal',
            created_at: xpReq.created_at || nowIso,
            updated_at: nowIso,
          })
          .select('id')
          .single()

        if (!taskErr && createdTask) {
          await admin.from('task_assignees').insert(
            validTargetUserIds.map((uid) => ({ task_id: createdTask.id, user_id: uid }))
          )
          console.log(`${tag} created done-task ${createdTask.id} in project ${resolvedProjectId}`)
        } else if (taskErr) {
          console.warn(`${tag} done-task insert warning:`, taskErr.message)
        }
      } catch (taskCatch) {
        console.warn(`${tag} done-task insert exception:`, taskCatch)
      }
    }

    // ── Invalidate server-side members cache ──────────────────────────────────
    try {
      const { invalidateMembersCache } = await import('@/utils/membersCache')
      invalidateMembersCache()
    } catch {
      // non-fatal
    }

    // ── Enrich updated request for response ───────────────────────────────────
    let enrichedProject = null
    if (updatedReq?.project_id) {
      try {
        const [projRes, deptsMap] = await Promise.all([
          admin.from('projects').select('id, name').eq('id', updatedReq.project_id).single(),
          getAllProjectDepartmentsMap(),
        ])
        if (projRes.data) {
          const pDeps = deptsMap[projRes.data.id] ?? []
          enrichedProject = {
            id: projRes.data.id,
            name: projRes.data.name,
            department: pDeps[0] ?? null,
          }
        }
      } catch {
        // ignore
      }
    }

    const finalResponse = {
      ...updatedReq,
      project: enrichedProject,
      target_profiles: targetProfiles.map((tp) => ({
        id: tp.id,
        full_name: tp.full_name,
        role: tp.role,
        xp_total: (Number(tp.xp_total) || 0) + xpAmount,
      })),
    }

    console.log(
      `${tag} approved  id=${id}  xp=${xpAmount}  targets=${validTargetUserIds.length}  ms=${Date.now() - start}`
    )

    return NextResponse.json({
      success: true,
      message: `امتیاز (${xpAmount} XP) با موفقیت به ${validTargetUserIds.length} عضو اعطا شد.`,
      request: finalResponse,
    })
  } catch (err: unknown) {
    console.error(`${tag} unhandled error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای سرور در بررسی درخواست' },
      { status: 500 }
    )
  }
}
