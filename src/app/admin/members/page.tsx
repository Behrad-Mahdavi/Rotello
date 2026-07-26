'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Profile } from '@/utils/database.types'

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (data) setMembers(data); setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setMembers(data)
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-default">اعضا</h1>
          <p className="text-sm text-subtle">{members.length} عضو</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-admin px-4 py-2 text-sm font-medium text-white transition-all hover:bg-admin-hover shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? 'لغو' : 'عضو جدید'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-surface p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-default">ساخت حساب جدید</h3>
          <form onSubmit={handleCreateMember} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-subtle">نام و نام خانوادگی</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm transition-all focus:bg-surface focus:outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-subtle">ایمیل</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm transition-all focus:bg-surface focus:outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-subtle">رمز عبور اولیه</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm transition-all focus:bg-surface focus:outline-none focus:ring-2 focus:ring-admin/20" />
              </div>
            </div>
            {error && <div className="rounded-xl bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" disabled={loading}
              className="rounded-xl bg-admin px-4 py-2 text-sm font-medium text-white transition-all hover:bg-admin-hover disabled:opacity-50 shadow-sm">
              {loading ? 'در حال ساخت...' : 'ساخت عضو'}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas">
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted">نام</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted">نقش</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted">XP</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted">تاریخ عضویت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-admin-subtle/30">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-admin-subtle text-xs font-bold text-admin">
                      {m.full_name.charAt(0)}
                    </div>
                    <span className="font-medium text-default">{m.full_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.role === 'admin' ? 'bg-admin-subtle text-admin' : 'bg-warning-subtle text-xp'
                  }`}>
                    {m.role === 'admin' ? 'مدیر' : 'عضو'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-xp">
                    {m.xp_total} XP
                  </span>
                </td>
                <td className="px-5 py-3.5 text-left text-xs text-muted">
                  {new Date(m.created_at).toLocaleDateString('fa-IR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
