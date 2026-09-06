'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Profile, XpAdjustment } from '@/utils/database.types'

interface MemberXpModalProps {
  isOpen: boolean
  onClose: () => void
  member: Profile | null
  initialType?: 'reward' | 'penalty'
  onSuccess?: (userId: string, newXp: number) => void
}

export default function MemberXpModal({
  isOpen,
  onClose,
  member,
  initialType = 'reward',
  onSuccess,
}: MemberXpModalProps) {
  const [activeTab, setActiveTab] = useState<'reward' | 'penalty'>(initialType)
  const [amount, setAmount] = useState<number | ''>(50)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<XpAdjustment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType)
      setError('')
      setReason('')
      setAmount(50)
      if (member?.id) {
        fetchHistory(member.id)
      }
    }
  }, [isOpen, initialType, member?.id])

  async function fetchHistory(userId: string) {
    setLoadingHistory(true)
    try {
      const { data, error: fetchErr } = await supabase
        .from('xp_adjustments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15)

      if (!fetchErr && data) {
        setHistory(data as XpAdjustment[])
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!isOpen || !member) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    if (!amount || amount <= 0) {
      setError('لطفاً یک مقدار معتبر برای امتیاز وارد کنید.')
      return
    }
    if (!reason.trim()) {
      setError('لطفاً دلیل ثبت تشویقی یا پنالتی را بنویسید.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { data: newXp, error: rpcError } = await supabase.rpc('admin_adjust_member_xp', {
        p_user_id: member.id,
        p_amount: Math.abs(Number(amount)),
        p_reason: reason.trim(),
        p_type: activeTab,
      })

      if (rpcError) {
        throw new Error(rpcError.message || 'خطا در ثبت امتیاز')
      }

      const finalXp = typeof newXp === 'number' ? newXp : (
        activeTab === 'reward' 
          ? member.xp_total + Number(amount)
          : Math.max(0, member.xp_total - Number(amount))
      )

      onSuccess?.(member.id, finalXp)
      // Refresh local history
      await fetchHistory(member.id)
      setReason('')
      setAmount(50)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته رخ داد')
    } finally {
      setLoading(false)
    }
  }

  const quickRewardAmounts = [25, 50, 100, 200]
  const quickPenaltyAmounts = [25, 50, 100, 200]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm">
              {member.full_name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-default">{member.full_name}</h3>
              <p className="text-xs text-muted">
                امتیاز فعلی: <span className="font-semibold text-amber-400">{member.xp_total} XP</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-default"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1.5 border border-border/60">
          <button
            type="button"
            onClick={() => { setActiveTab('reward'); setError('') }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'reward'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted hover:text-default'
            }`}
          >
            <span className="text-sm">🎁</span>
            <span>اعطای تشویقی (+XP)</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('penalty'); setError('') }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'penalty'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-muted hover:text-default'
            }`}
          >
            <span className="text-sm">⚠️</span>
            <span>ثبت پنالتی (-XP)</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Quick amount chips */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              مقدار امتیاز {activeTab === 'reward' ? 'تشویقی' : 'پنالتی'}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(activeTab === 'reward' ? quickRewardAmounts : quickPenaltyAmounts).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    amount === q
                      ? activeTab === 'reward'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-rose-500 bg-rose-500/10 text-rose-400'
                      : 'border-border bg-surface-2 text-muted hover:border-border-subtle hover:text-default'
                  }`}
                >
                  {activeTab === 'reward' ? `+${q}` : `-${q}`} XP
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="مثال: 50"
                required
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none"
              />
              <span className="absolute left-3.5 top-2.5 text-xs font-medium text-muted">XP</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              دلیل {activeTab === 'reward' ? 'تشویقی' : 'پنالتی'} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                activeTab === 'reward'
                  ? 'مثال: همکاری فوق‌العاده در ددلاین پروژه، رفع باگ حساس...'
                  : 'مثال: عدم حضور در جلسه هماهنگی، تاخیر غیرموجه در تحویل...'
              }
              required
              className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm transition-all focus:border-emerald-500/50 focus:bg-surface focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
              activeTab === 'reward'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {loading ? 'در حال ثبت...' : activeTab === 'reward' ? 'ثبت و اعطای تشویقی' : 'ثبت و اعمال پنالتی'}
          </button>
        </form>

        {/* History Section */}
        <div className="mt-6 border-t border-border/80 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-default">سوابق اخیر امتیازات</h4>
            {loadingHistory && <span className="text-[10px] text-muted">در حال دریافت...</span>}
          </div>

          {history.length === 0 && !loadingHistory ? (
            <p className="text-center text-xs text-muted py-3">تاکنون هیچ سابقه‌ای برای این عضو ثبت نشده است.</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {history.map((h) => {
                const isPositive = h.amount > 0
                const typeLabels: Record<string, { title: string; color: string }> = {
                  reward: { title: 'تشویقی', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  penalty: { title: 'پنالتی', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                  task_completion: { title: 'تکمیل تسک', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  task_reversal: { title: 'کسر تسک', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                }
                const badge = typeLabels[h.type] || { title: h.type, color: 'bg-gray-500/10 text-gray-400' }

                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`rounded-full border px-1.5 py-0.2 text-[10px] font-medium ${badge.color}`}>
                          {badge.title}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(h.created_at).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                      <p className="text-default text-xs truncate" title={h.reason}>
                        {h.reason}
                      </p>
                    </div>
                    <span
                      className={`font-bold shrink-0 text-xs ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${h.amount}` : h.amount} XP
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
