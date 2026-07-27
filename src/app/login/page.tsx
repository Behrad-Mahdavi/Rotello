'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm">
          <Image src="/logog.png" alt="رکاد" width={32} height={48} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-default">رکاد</h1>
        <p className="mt-1 text-sm text-muted">ورود به سامانه مدیریت تسک</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-sm">
        <form onSubmit={handleLogin} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm font-medium text-muted">ایمیل</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-default placeholder:text-muted transition-all focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted">رمز عبور</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-default placeholder:text-muted transition-all focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>

          {error && <div className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
            {loading ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          حساب کاربری ندارید؟{' '}
          <Link href="/signup" className="font-medium text-action transition-colors hover:text-action-hover">ثبت‌نام کنید</Link>
        </div>
      </div>
    </div>
  )
}
