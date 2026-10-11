'use client'

import { useState, useEffect } from 'react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { toPersianDigits } from '@/utils/jalaali'
import { DEPARTMENTS, DepartmentKey } from '@/constants/departments'
import { X, Sparkles, Send, CheckCircle2, AlertCircle, FolderKanban, ChevronDown } from 'lucide-react'

interface RequestXpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface ProjectOption {
  id: string
  name: string
  department: string | null
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects/my-projects')
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data.projects)) {
            setProjects(data.projects)
          }
        }
      } catch {
        // silent fallback
      } finally {
        if (isMounted) setLoadingProjects(false)
      }
    }

    loadProjects()
    return () => {
      isMounted = false
    }
  }, [])

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
          project_id: selectedProjectId.trim() ? selectedProjectId.trim() : null,
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

            {/* Project Selection (Optional - only member's assigned projects) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-default flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-action" />
                  <span>پروژه مرتبط</span>
                  <span className="text-[11px] font-normal text-muted">(اختیاری)</span>
                </label>
                <span className="text-[10px] text-muted">
                  فقط پروژه‌های عضویت شما
                </span>
              </div>

              {loadingProjects ? (
                <div className="h-10 w-full rounded-xl bg-surface-2 animate-pulse border border-border" />
              ) : projects.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20 cursor-pointer pl-9"
                  >
                    <option value="" className="bg-surface text-default">بدون پروژه مشخص (فعالیت یا تسک عمومی)</option>
                    {projects.map((p) => {
                      const depConfig = p.department ? DEPARTMENTS[p.department as DepartmentKey] : null
                      const depLabel = depConfig ? ` (${depConfig.label})` : ''
                      return (
                        <option key={p.id} value={p.id} className="bg-surface text-default">
                          {p.name}{depLabel}
                        </option>
                      )
                    })}
                  </select>
                  <div className="pointer-events-none absolute left-3 top-3 text-muted">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/80 bg-surface-2/60 p-2.5 text-xs text-muted flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-muted/70 shrink-0" />
                  <span>شما در حال حاضر عضو پروژه‌ای نیستید؛ درخواست به‌صورت «فعالیت عمومی» ثبت خواهد شد.</span>
                </div>
              )}
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

            {/* Info Notice */}
            <div className="rounded-xl border border-border/80 bg-surface-2/60 p-3 text-xs text-muted flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-action shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                راهبر در صفحه مدیریت، درخواست شما را بررسی می‌کند، پروژه و عنوان نهایی تسک را تعیین کرده و بر اساس نوع (تسک یا تشویقی)، امتیاز متناسب را تخصیص می‌دهد.
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
