import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { XpRequest, Profile } from '@/utils/database.types'

export const dynamic = 'force-dynamic'

// GET /api/xp-requests - List XP requests
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Use admin client if available to ensure smooth data retrieval with relations, or fallback to standard client
    let dbClient = supabase
    try {
      dbClient = createAdminClient() as unknown as typeof supabase
    } catch {
      // Keep standard client
    }

    let query = dbClient
      .from('xp_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      // Non-admins can only see their own requests
      query = query.eq('user_id', user.id)
    }

    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data: requestsData, error: queryError } = await query

    if (queryError) {
      // If table does not exist or schema issue, return clean empty list with info
      console.warn('Error fetching xp_requests:', queryError)
      return NextResponse.json({
        requests: [],
        warning: queryError.message,
      })
    }

    const requests = (requestsData || []) as XpRequest[]

    if (requests.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Collect all unique user IDs (requesters, reviewers, target users) and project IDs
    const userIds = new Set<string>()
    const projectIds = new Set<string>()
    for (const r of requests) {
      if (r.user_id) userIds.add(r.user_id)
      if (r.reviewed_by) userIds.add(r.reviewed_by)
      if (r.target_user_ids && Array.isArray(r.target_user_ids)) {
        for (const tid of r.target_user_ids) userIds.add(tid)
      }
      if (r.project_id) {
        projectIds.add(r.project_id)
      }
    }

    const profilesMap = new Map<string, Profile>()
    const idsArray = Array.from(userIds)
    if (idsArray.length > 0) {
      const { data: profilesData } = await dbClient
        .from('profiles')
        .select('id, full_name, role, avatar_url, xp_total, departments')
        .in('id', idsArray)

      if (profilesData) {
        for (const p of profilesData as Profile[]) {
          profilesMap.set(p.id, p)
        }
      }
    }

    const projectsMap = new Map<string, { id: string; name: string; department: string | null }>()
    const projIdsArray = Array.from(projectIds)
    if (projIdsArray.length > 0) {
      try {
        const { data: projectsData } = await dbClient
          .from('projects')
          .select('id, name, department')
          .in('id', projIdsArray)

        if (projectsData) {
          for (const proj of projectsData) {
            projectsMap.set(proj.id, proj)
          }
        }
      } catch {
        // ignore
      }
    }

    // Enrich requests with profile and project data
    const enriched = requests.map((req) => {
      const requester = profilesMap.get(req.user_id) || null
      const reviewer = req.reviewed_by ? profilesMap.get(req.reviewed_by) || null : null
      const target_profiles = (req.target_user_ids || []).map((id) => profilesMap.get(id)).filter(Boolean) as Profile[]
      const project = req.project_id ? projectsMap.get(req.project_id) || null : null

      return {
        ...req,
        project,
        requester: requester
          ? {
              id: requester.id,
              full_name: requester.full_name,
              role: requester.role,
              avatar_url: requester.avatar_url,
              xp_total: requester.xp_total,
              departments: requester.departments,
            }
          : null,
        reviewer: reviewer
          ? {
              id: reviewer.id,
              full_name: reviewer.full_name,
              role: reviewer.role,
            }
          : null,
        target_profiles: target_profiles.map((tp) => ({
          id: tp.id,
          full_name: tp.full_name,
          role: tp.role,
          avatar_url: tp.avatar_url,
          xp_total: tp.xp_total,
        })),
      }
    })

    return NextResponse.json(
      { requests: enriched },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای ناشناخته در دریافت درخواست‌ها' },
      { status: 500 }
    )
  }
}

// POST /api/xp-requests - Member submits a new XP request
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { title, description, suggested_xp, project_id } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'ثبت عنوان فعالیت یا تسک الزامی است.' }, { status: 400 })
    }

    const trimmedTitle = title.trim()
    const trimmedDesc = typeof description === 'string' ? description.trim() : null
    let validSuggestedXp: number | null = null
    if (suggested_xp !== undefined && suggested_xp !== null && suggested_xp !== '') {
      const parsed = Number(suggested_xp)
      if (!isNaN(parsed) && parsed > 0) {
        validSuggestedXp = Math.min(Math.floor(parsed), 1000)
      }
    }

    const validProjectId =
      typeof project_id === 'string' && project_id.trim() ? project_id.trim() : null

    let dbClient = supabase
    try {
      dbClient = createAdminClient() as unknown as typeof supabase
    } catch {
      // fallback to user supabase client
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      title: trimmedTitle,
      description: trimmedDesc,
      suggested_xp: validSuggestedXp,
      status: 'pending',
    }

    if (validProjectId) {
      insertPayload.project_id = validProjectId
    }

    let insertedRecord = null
    let { data: inserted, error: insertError } = await dbClient
      .from('xp_requests')
      .insert(insertPayload)
      .select('*')
      .single()

    // Defensive fallback: if project_id column does not exist yet in DB schema
    if (insertError && validProjectId && insertError.message.includes('project_id')) {
      delete insertPayload.project_id
      const fallbackRes = await dbClient
        .from('xp_requests')
        .insert(insertPayload)
        .select('*')
        .single()

      inserted = fallbackRes.data
      insertError = fallbackRes.error
    }

    if (insertError) {
      return NextResponse.json(
        { error: `خطا در ثبت درخواست: ${insertError.message}` },
        { status: 500 }
      )
    }

    insertedRecord = inserted

    return NextResponse.json({
      success: true,
      request: insertedRecord,
    }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطای سرور در ثبت درخواست' },
      { status: 500 }
    )
  }
}
