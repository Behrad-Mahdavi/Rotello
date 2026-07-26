'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/utils/database.types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data); setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted">...</div>
  if (!profile) return <div className="flex min-h-screen items-center justify-center text-sm text-danger">پروفایل یافت نشد</div>

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface shadow-sm overflow-hidden">
              <Image src="/logog.png" alt="رکاد" width={24} height={24} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-default">رکاد</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/projects')}
              className="rounded-xl bg-canvas px-3 py-1.5 text-xs font-medium text-subtle transition-colors hover:bg-border">
              بازگشت
            </button>
            <LogoutButton minimal />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-action to-action-hover text-3xl font-bold text-on-dark shadow-sm">
              {profile.full_name.charAt(0)}
            </div>
            <h1 className="text-xl font-bold text-default">{profile.full_name}</h1>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              profile.role === 'admin' ? 'bg-admin-subtle text-admin' : 'bg-warning-subtle text-xp'
            }`}>
              {profile.role === 'admin' ? 'مدیر' : 'عضو'}
            </span>

            <div className="mt-6 rounded-2xl bg-canvas p-6">
              <p className="text-xs font-medium text-subtle">امتیاز کل</p>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-action">{profile.xp_total}</span>
                <span className="text-sm font-medium text-xp">XP</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
