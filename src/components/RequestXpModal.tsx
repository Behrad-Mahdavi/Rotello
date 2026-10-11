'use client'

import { useState } from 'react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { toPersianDigits } from '@/utils/jalaali'
import { X, Sparkles, Send, CheckCircle2, AlertCircle } from 'lucide-react'

interface RequestXpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function RequestXpModal({
  isOpen,
  onClose,
  onSuccess,
}: RequestXpModalProps) {
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  return <RequestXpModalDialog onClose={onClose} onSuccess={onSuccess} />
}

function RequestXpModalDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess?: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [suggestedXp, setSuggestedXp] = useState<number | ''>(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('لطفاً عنوان فعالیت یا علت درخواست را وارد کنید.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/xp-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          suggested_xp: suggestedXp === '' ? null : Number(suggestedXp),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت درخواست')
      }

      setSubmitted(true)
      window.dispatchEvent(new CustomEvent('xp-request-created'))
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته رخ داد')
    } finally {
      setLoading(false)
    }
  }

  const quickXpChips = [25, 50, 75, 100, 150, 200]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-2xs">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-default text-base sm:text-lg flex items-center gap-2">
                ثبت درخواست امتیاز (XP)
              </h3>
              <p className="text-xs text-muted mt-0.5">
                تسک یا کاری انجام دادی که امتیازش جا مانده؟ اینجا اعلام کن.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-default transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-default">درخواست شما با موفقیت ثبت شد</h4>
              <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                درخواست شما در کارتابل راهبران سیستم قرار گرفت. پس از بررسی، نوع تسک و مقدار XP تایید و به حسابت افزوده می‌شود.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rokad-btn-primary min-w-[140px] py-2 text-xs"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Title / Task Name */}
            <div>
              <label className="block text-xs font-semibold text-default mb-1.5">
                عنوان فعالیت یا علت درخواست <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: طراحی پوستر رویداد، توسعه ماژول ثبت‌نام، رفع باگ صفحه تسک‌ها..."
                required
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default placeholder:text-muted/70 transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20"
              />
            </div>

            {/* Description / Work Details */}
            <div>
              <label className="block text-xs font-semibold text-default mb-1.5">
                توضیح کوتاه و گزارش کار
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیح دهید چه کارهایی انجام شده، لینک خروجی کار (در صورت وجود) یا هر نکته‌ای که به راهبر برای تایید سریع‌تر کمک می‌کند..."
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default placeholder:text-muted/70 transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20 resize-none leading-relaxed"
              />
            </div>

            {/* Suggested XP */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-default">
                  پیشنهاد امتیاز (XP) <span className="text-[11px] font-normal text-muted">(اختیاری)</span>
                </label>
                <span className="text-[11px] text-muted">
                  تصمیم نهایی با راهبر است
                </span>
              </div>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {quickXpChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSuggestedXp(q)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer ${
                      suggestedXp === q
                        ? 'border-amber-500 bg-amber-500/15 text-amber-500 shadow-2xs'
                        : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-default'
                    }`}
                  >
                    {toPersianDigits(q)} XP
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={suggestedXp}
                  onChange={(e) => setSuggestedXp(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 50"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs sm:text-sm text-default transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20"
                />
                <span className="absolute left-3.5 top-2 text-xs font-bold text-muted pointer-events-none">
                  XP
                </span>
              </div>
            </div>

            {/* Info Notice */}
            <div className="rounded-xl border border-border/80 bg-surface-2/60 p-3 text-xs text-muted flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-action shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                راهبر در صفحه مدیریت، درخواست شما را بررسی می‌کند، عنوان نهایی تسک را ثبت کرده و بر اساس نوع (تسک یا تشویقی)، امتیاز متناسب را به شما و همکارانتان تخصیص می‌دهد.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500 font-medium">
                {error}
              </div>
            )}

            {/* Submit & Cancel Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-default transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rokad-btn-primary min-w-[130px] px-5 py-2.5 text-xs sm:text-sm shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <span>در حال ارسال...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 rotate-180" />
                    <span>ارسال درخواست</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
