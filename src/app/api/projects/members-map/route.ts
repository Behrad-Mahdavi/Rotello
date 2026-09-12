import { NextResponse } from 'next/server'
import { getAllProjectMemberIds } from '@/utils/projectMembersStore'

export async function GET() {
  try {
    const map = await getAllProjectMemberIds()
    return NextResponse.json({ map })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
