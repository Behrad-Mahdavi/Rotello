'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role: 'member' } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-action/20 shadow-sm">
          <Image src="/logog.png" alt="رکاد" width={48} height={48} className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-default">ایجاد حساب کاربری</h1>
        <p className="mt-1 text-sm text-muted">به رکاد بپیوندید</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-sm">
        <form onSubmit={handleSignup} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm font-medium text-muted">نام و نام خانوادگی</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-default placeholder:text-muted transition-all focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted">ایمیل</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-default placeholder:text-muted transition-all focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted">رمز عبور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-default placeholder:text-muted transition-all focus:border-action/50 focus:bg-surface focus:outline-none" />
          </div>

          {error && <div className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-action-hover disabled:opacity-50 shadow-sm">
            {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href="/login" className="font-medium text-action transition-colors hover:text-action-hover">وارد شوید</Link>
        </div>
      </div>
    </div>
  )
}
