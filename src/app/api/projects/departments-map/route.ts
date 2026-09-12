import { NextResponse } from 'next/server'
import { getAllProjectDepartmentsMap } from '@/utils/projectDepartmentsStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const map = await getAllProjectDepartmentsMap()
    return NextResponse.json(
      { map },
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
