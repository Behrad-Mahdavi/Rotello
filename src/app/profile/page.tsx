'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile } from '@/utils/database.types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data); setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">...</div>
    </div>
  )
  if (!profile) return null

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-3xl font-bold text-white shadow-sm">
              {profile.full_name.charAt(0)}
            </div>
            <h1 className="text-xl font-bold text-default">{profile.full_name}</h1>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              profile.role === 'admin' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {profile.role === 'admin' ? 'مدیر' : 'عضو'}
            </span>

            <div className="mt-6 rounded-xl bg-surface-2 p-6">
              <p className="text-xs font-medium text-muted">امتیاز کل</p>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-emerald-500">{profile.xp_total}</span>
                <span className="text-sm font-medium text-amber-400">XP</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
