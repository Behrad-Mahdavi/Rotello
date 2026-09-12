import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
} from '@/utils/projectMembersStore'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'شناسه پروژه مشخص نشده است.' }, { status: 400 })
    }

    const members = await getProjectMembers(projectId)
    return NextResponse.json(
      { members },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'احراز هویت الزامی است.' }, { status: 401 })
    }

    const { projectId } = await params
    const body = await request.json()
    const userId = body.user_id as string

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'شناسه پروژه و کاربر الزامی است.' }, { status: 400 })
    }

    await addProjectMember(projectId, userId)
    const members = await getProjectMembers(projectId)
    return NextResponse.json(
      { success: true, members },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'احراز هویت الزامی است.' }, { status: 401 })
    }

    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    let userId = searchParams.get('userId')

    if (!userId) {
      try {
        const body = await request.json()
        userId = body.user_id
      } catch {
        // ignore body parse error
      }
    }

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'شناسه پروژه و کاربر الزامی است.' }, { status: 400 })
    }

    await removeProjectMember(projectId, userId)
    const members = await getProjectMembers(projectId)
    return NextResponse.json(
      { success: true, members },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
