'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8 transition-colors overflow-hidden">
      {/* Decorative Ambient Background Glows */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#59BBAF]/10 blur-3xl dark:bg-[#59BBAF]/5" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#202A5A]/10 blur-3xl dark:bg-[#202A5A]/20" />

      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
        <div className="rounded-xl border border-border/70 bg-surface/70 backdrop-blur-md p-1 shadow-2xs">
          <ThemeToggle />
        </div>
      </div>

      {/* Brand Header */}
      <div className="mb-6 text-center select-none relative z-10">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-[1.5px] border-border bg-surface p-1 shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] transition-transform hover:scale-105 overflow-hidden">
          <Image src="/logo-main.jpg" alt="روتلو" width={64} height={64} className="h-full w-full rounded-xl object-cover" priority />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-default">روتلو</h1>
          <span className="inline-flex items-center rounded-full badge-club px-3 py-0.5 text-xs font-black tracking-wide">
            باشگاه
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md rounded-3xl border-[1.5px] border-border bg-surface p-6 sm:p-8 shadow-[3.5px_3.5px_0_#202A5A] dark:shadow-[3.5px_3.5px_0_#59BBAF] transition-all">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#59BBAF] via-[#202A5A] to-[#652D90] rounded-full mb-6" />

        <div className="mb-6 text-center">
          <h2 className="text-base sm:text-lg font-black text-default">ورود به حساب کاربری</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-default mb-1.5">ایمیل</label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@rokad.ir"
                className="block w-full rounded-xl border border-border bg-surface-2/60 pr-10 pl-4 py-2.5 text-sm text-default placeholder:text-muted/60 transition-all focus:border-action focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20"
              />
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-default mb-1.5">رمز عبور</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="block w-full rounded-xl border border-border bg-surface-2/60 pr-10 pl-10 py-2.5 text-sm text-default placeholder:text-muted/60 transition-all focus:border-action focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-default transition-colors rounded-lg cursor-pointer"
                title={showPassword ? 'مخفی‌کردن رمز' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs sm:text-sm text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-action py-3 text-sm font-black text-white shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] transition-all hover:bg-action-hover active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            <LogIn className="h-4 w-4" />
            <span>{loading ? 'در حال ورود...' : 'ورود به سامانه'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border/70 text-center text-xs sm:text-sm text-muted">
          حساب کاربری ندارید؟{' '}
          <Link href="/signup" className="font-bold text-action transition-colors hover:text-action-hover hover:underline">
            ثبت‌نام کنید
          </Link>
        </div>
      </div>
    </div>
  )
}
