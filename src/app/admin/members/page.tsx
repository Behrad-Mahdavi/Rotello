'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import type { Profile } from '@/utils/database.types'

export default function AdminMembersPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/projects'); return }
      setProfile(prof)
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (data) setMembers(data); setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setMembers(data)
  }

  async function handleDeleteMember(id: string, name: string) {
    if (!confirm(`آیا از حذف "${name}" اطمینان دارید؟ تمام اطلاعات این کاربر حذف خواهد شد.`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await reload()
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: name }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setEmail(''); setPassword(''); setName(''); setShowForm(false)
      await reload()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }

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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-default">مدیریت اعضا</h2>
            <p className="text-sm text-muted">{members.length} عضو</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 shadow-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'لغو' : 'عضو جدید'}
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-default">ساخت حساب جدید</h3>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted">نام و نام خانوادگی</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">ایمیل</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">رمز عبور اولیه</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                    className="mt-1 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none" />
                </div>
              </div>
              {error && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
              <button type="submit" disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
                {loading ? 'در حال ساخت...' : 'ساخت عضو'}
              </button>
            </form>
          </div>
        )}

        {members.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">هیچ عضوی وجود ندارد.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => {
              const stats = { total: 0, done: 0, active: 0 }
              return (
                <div key={m.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:shadow-md">
                  {m.role !== 'admin' && m.id !== profile.id && (
                    <button onClick={() => handleDeleteMember(m.id, m.full_name)}
                      className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/20">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br ${
                        m.role === 'admin' ? 'from-violet-500 to-purple-600' : 'from-emerald-500 to-teal-600'
                      }`}>
                        {m.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-default">{m.full_name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${
                          m.role === 'admin' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {m.role === 'admin' ? 'مدیر' : 'عضو'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {m.xp_total > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/10 py-2 text-xs text-amber-400">
                      <span className="font-bold">{m.xp_total}</span> XP
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
