/**
 * GET /api/muse/xp-requests?status=pending
 *
 * Muse-agent endpoint — returns XP requests (default: pending).
 * Auth: Bearer MUSE_API_TOKEN (env var, timingSafeEqual)
 *
 * Query params:
 *   status  – 'pending' | 'approved' | 'rejected'  (default: 'pending')
 *   limit   – max rows to return                    (default: 50, max: 100)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAllProjectDepartmentsMap } from '@/utils/projectDepartmentsStore'
import { verifyMuseToken } from '@/app/api/muse/_auth'
import type { XpRequest, Profile, Role, MemberDepartment } from '@/utils/database.types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const tag = '[muse/xp-requests GET]'
  const start = Date.now()

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    if (!verifyMuseToken(request.headers.get('Authorization'))) {
      console.warn(`${tag} 401 – invalid or missing token  ip=${
        request.headers.get('x-forwarded-for') ?? 'unknown'
      }`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Params ──────────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url)
    const rawStatus = searchParams.get('status') ?? 'pending'
    const statusFilter = ['pending', 'approved', 'rejected'].includes(rawStatus)
      ? rawStatus
      : 'pending'

    const rawLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Math.min(isNaN(rawLimit) ? 50 : Math.max(1, rawLimit), 100)

    console.log(`${tag} status=${statusFilter} limit=${limit}`)

    // ── Query ───────────────────────────────────────────────────────────────
    const admin = createAdminClient()

    const { data: requestsData, error: queryError } = await admin
      .from('xp_requests')
      .select('*')
      .eq('status', statusFilter)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (queryError) {
      console.error(`${tag} DB error:`, queryError.message)
      return NextResponse.json(
        { error: `DB error: ${queryError.message}` },
        { status: 500 }
      )
    }

    const requests = (requestsData ?? []) as XpRequest[]

    if (requests.length === 0) {
      console.log(`${tag} 0 results  ms=${Date.now() - start}`)
      return NextResponse.json({ requests: [] })
    }

    // ── Enrich with profiles & projects ─────────────────────────────────────
    const userIds = new Set<string>()
    const projectIds = new Set<string>()

    for (const r of requests) {
      if (r.user_id) userIds.add(r.user_id)
      if (r.reviewed_by) userIds.add(r.reviewed_by)
      if (Array.isArray(r.target_user_ids)) r.target_user_ids.forEach((id) => userIds.add(id))
      if (r.project_id) projectIds.add(r.project_id)
    }

    const profilesMap = new Map<string, Profile>()

    if (userIds.size > 0) {
      const idsArr = Array.from(userIds)
      const [profilesRes, usersRes] = await Promise.all([
        admin.from('profiles').select('id, full_name, role, xp_total, created_at').in('id', idsArr),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null })),
      ])

      const authMap = new Map<string, { role?: Role; avatar_url?: string | null; full_name?: string; departments?: MemberDepartment[] }>()
      if (usersRes.data?.users) {
        for (const u of usersRes.data.users) {
          authMap.set(u.id, {
            role: u.user_metadata?.role as Role,
            avatar_url: u.user_metadata?.avatar_url as string ?? null,
            full_name: u.user_metadata?.full_name as string,
            departments: u.user_metadata?.departments as MemberDepartment[],
          })
        }
      }

      for (const p of profilesRes.data ?? []) {
        const a = authMap.get(p.id)
        profilesMap.set(p.id, {
          id: p.id,
          full_name: a?.full_name ?? p.full_name ?? 'عضو',
          role: (a?.role ?? p.role ?? 'member') as Role,
          xp_total: Number(p.xp_total) || 0,
          created_at: p.created_at ?? '',
          avatar_url: a?.avatar_url ?? null,
          departments: a?.departments ?? [],
        })
      }
    }

    const projectsMap = new Map<string, { id: string; name: string; department: string | null }>()
    if (projectIds.size > 0) {
      try {
        const [projRes, deptsMap] = await Promise.all([
          admin.from('projects').select('id, name').in('id', Array.from(projectIds)),
          getAllProjectDepartmentsMap(),
        ])
        for (const proj of projRes.data ?? []) {
          const pDeps = deptsMap[proj.id] ?? []
          projectsMap.set(proj.id, { id: proj.id, name: proj.name, department: pDeps[0] ?? null })
        }
      } catch {
        // non-fatal
      }
    }

    const enriched = requests.map((req) => {
      const requester = profilesMap.get(req.user_id) ?? null
      const reviewer = req.reviewed_by ? (profilesMap.get(req.reviewed_by) ?? null) : null
      const target_profiles = (req.target_user_ids ?? [])
        .map((id) => profilesMap.get(id))
        .filter(Boolean) as Profile[]
      const project = req.project_id ? (projectsMap.get(req.project_id) ?? null) : null

      return {
        ...req,
        project,
        requester: requester
          ? { id: requester.id, full_name: requester.full_name, role: requester.role, avatar_url: requester.avatar_url, xp_total: requester.xp_total, departments: requester.departments }
          : null,
        reviewer: reviewer
          ? { id: reviewer.id, full_name: reviewer.full_name, role: reviewer.role }
          : null,
        target_profiles: target_profiles.map((tp) => ({
          id: tp.id, full_name: tp.full_name, role: tp.role, avatar_url: tp.avatar_url, xp_total: tp.xp_total,
        })),
      }
    })

    console.log(`${tag} returned ${enriched.length} request(s)  ms=${Date.now() - start}`)
    return NextResponse.json(
      { requests: enriched },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: unknown) {
    console.error(`${tag} unhandled error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
