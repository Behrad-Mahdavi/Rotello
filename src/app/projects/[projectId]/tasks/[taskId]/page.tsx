'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import LogoutButton from '@/components/LogoutButton'
import TaskDetailModal from '@/components/TaskDetailModal'
import type { Profile } from '@/utils/database.types'

export default function TaskDetailPage({ params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const { projectId, taskId } = use(params)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    if (!taskId) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof); setLoading(false)
    }
    load()
  }, [taskId])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted">...</div>

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button onClick={() => router.push(`/projects/${projectId}/board`)}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-subtle transition-colors hover:bg-canvas">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            بازگشت به بورد
          </button>
          <LogoutButton minimal />
        </div>
      </header>
      <main className="flex-1 p-4">
        {profile && taskId && <TaskDetailModal taskId={taskId} profile={profile} onClose={() => router.push(`/projects/${projectId}/board`)} onTaskDeleted={() => router.push(`/projects/${projectId}/board`)} />}
      </main>
    </div>
  )
}
