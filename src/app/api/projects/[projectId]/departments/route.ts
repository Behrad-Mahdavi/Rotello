import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getProjectDepartments, setProjectDepartments } from '@/utils/projectDepartmentsStore'
import type { DepartmentKey } from '@/utils/database.types'

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

    const departments = await getProjectDepartments(projectId)
    return NextResponse.json(
      { departments },
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
    const departments = (body.departments || []) as DepartmentKey[]

    if (!projectId) {
      return NextResponse.json({ error: 'شناسه پروژه الزامی است.' }, { status: 400 })
    }

    const updated = await setProjectDepartments(projectId, departments)
    return NextResponse.json(
      { success: true, departments: updated },
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
