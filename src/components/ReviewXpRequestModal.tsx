'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import UserAvatar from '@/components/UserAvatar'
import { formatToPersianDate, toPersianDigits } from '@/utils/jalaali'
import { getRoleInfo, DEPARTMENTS, DepartmentKey } from '@/constants/departments'
import type { Profile, XpRequest, XpRequestAwardType } from '@/utils/database.types'
import {
  X,
  CheckCircle2,
  Gift,
  AlertTriangle,
  Users,
  Search,
  Sparkles,
  Award,
  Check,
  UserPlus,
  FolderKanban,
  ChevronDown,
} from 'lucide-react'

interface ReviewXpRequestModalProps {
  isOpen: boolean
  onClose: () => void
  request: XpRequest | null
  membersList: Profile[]
  onSuccess?: (updatedReq: XpRequest) => void
}

interface ProjectOption {
  id: string
  name: string
  department: string | null
}

export default function ReviewXpRequestModal({
  isOpen,
  onClose,
  request,
  membersList,
  onSuccess,
}: ReviewXpRequestModalProps) {
  useBodyScrollLock(isOpen)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !request || !mounted) return null

  return createPortal(
    <ReviewXpRequestDialog
      key={request.id}
      request={request}
      onClose={onClose}
      membersList={membersList}
      onSuccess={onSuccess}
    />,
    document.body
  )
}

function ReviewXpRequestDialog({
  request,
  onClose,
  membersList,
  onSuccess,
}: {
  request: XpRequest
  onClose: () => void
  membersList: Profile[]
  onSuccess?: (updatedReq: XpRequest) => void
}) {
  const [finalTaskName, setFinalTaskName] = useState(request.title || '')
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    request.project_id || request.project?.id || ''
  )
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [awardType, setAwardType] = useState<XpRequestAwardType>(request.award_type || 'task_completion')
  const [awardedXp, setAwardedXp] = useState<number | ''>(
    request.suggested_xp && request.suggested_xp > 0 ? request.suggested_xp : 50
  )
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => {
    const rawIds = request.target_user_ids?.length ? request.target_user_ids : [request.user_id]
    return rawIds.filter((id) => {
      const m = membersList.find((mem) => mem.id === id)
      if (m) return m.role === 'member'
      if (request.requester && request.requester.id === id) {
        return request.requester.role === 'member'
      }
      return true
    })
  })
  const [reviewerNote, setReviewerNote] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load available projects for admin / leader
  useEffect(() => {
    let isMounted = true
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects/my-projects?all=true')
        if (res.ok) {
          const data = await res.json()
          if (isMounted && Array.isArray(data.projects)) {
            setAllProjects(data.projects)
          }
        }
      } catch {
        // silent
      } finally {
        if (isMounted) setLoadingProjects(false)
      }
    }
    loadProjects()
    return () => {
      isMounted = false
    }
  }, [])

  // Filter members for multi-select picker: Only regular members receive XP
  const filteredMembers = useMemo(() => {
    return membersList.filter((m) => {
      if (m.role !== 'member') return false
      if (!memberSearch.trim()) return true
      const q = memberSearch.toLowerCase()
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
      )
    })
  }, [membersList, memberSearch])

  // Resolve requester with fallback to membersList by user_id
  const requester = useMemo(() => {
    if (request.requester && request.requester.full_name) {
      return request.requester
    }
    const fromList = membersList.find((m) => m.id === request.user_id)
    if (fromList) {
      return fromList
    }
    return request.requester || null
  }, [request, membersList])

  // Selected profiles
  const selectedProfiles = useMemo(() => {
    const list: Profile[] = []
    for (const id of selectedUserIds) {
      const found = membersList.find((m) => m.id === id)
      if (found) {
        list.push(found)
      } else if (requester && requester.id === id) {
        list.push(requester as Profile)
      }
    }
    return list
  }, [membersList, selectedUserIds, requester])

  function toggleMember(memberId: string) {
    setSelectedUserIds((prev) => {
      if (prev.includes(memberId)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter((id) => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  const roleInfo = getRoleInfo(requester?.role)
  const quickXpChips = [25, 50, 75, 100, 150, 200]

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    if (!request) return
    if (!finalTaskName.trim()) {
      setError('لطفاً نام نهایی تسک یا فعالیت را وارد کنید.')
      return
    }
    if (!awardedXp || Number(awardedXp) <= 0) {
      setError('مقدار امتیاز (XP) باید بزرگتر از صفر باشد.')
      return
    }
    if (selectedUserIds.length === 0) {
      setError('حداقل یک عضو باید به عنوان دریافت‌کننده امتیاز انتخاب شود.')
      return
    }
    if (awardType === 'task_completion' && !selectedProjectId.trim()) {
      setError('برای نوع «تکمیل تسک»، لطفاً پروژه مرتبط با تسک را مشخص کنید تا تسک در بورد کانبان و کارنامه تسک‌های عضو درج شود (یا نوع را روی «پاداش تشویقی» بگذارید).')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/xp-requests/${request.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          final_task_name: finalTaskName.trim(),
          award_type: awardType,
          awarded_xp: Math.round(Number(awardedXp)),
          target_user_ids: selectedUserIds,
          reviewer_note: reviewerNote.trim() || null,
          project_id: selectedProjectId.trim() ? selectedProjectId.trim() : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'خطا در تایید درخواست')
      }

      window.dispatchEvent(new CustomEvent('xp-requests-updated'))
      window.dispatchEvent(new CustomEvent('profile-updated'))
      window.dispatchEvent(new CustomEvent('member-xp-updated'))
      onSuccess?.(data.request)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای سرور رخ داد')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (!request) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/xp-requests/${request.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          reviewer_note: rejectNote.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'خطا در رد درخواست')
      }

      window.dispatchEvent(new CustomEvent('xp-requests-updated'))
      window.dispatchEvent(new CustomEvent('profile-updated'))
      onSuccess?.(data.request)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای سرور رخ داد')
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
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-action/10 text-action border border-action/25 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-default text-base sm:text-lg">
                بررسی و تایید درخواست امتیاز (XP)
              </h3>
              <p className="text-xs text-muted mt-0.5">
                توسط راهبر سیستم: تایید عنوان، پروژه، نوع، مقدار امتیاز و اعضا
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

        {/* Member & Request Snapshot Card */}
        <div className="mt-4 rounded-2xl border border-border/80 bg-surface-2/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <UserAvatar
                src={requester?.avatar_url || null}
                name={requester?.full_name || 'عضو'}
                role={requester?.role}
                size="base"
                shape="circle"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-default">
                    {requester?.full_name || 'عضو ناشناس'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleInfo.colorClass}`}>
                    {roleInfo.label}
                  </span>
                </div>
                <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                  <span>امتیاز فعلی: <strong className="text-amber-500 font-extrabold">{toPersianDigits(requester?.xp_total || 0)} XP</strong></span>
                  <span>•</span>
                  <span>تاریخ ارسال: {formatToPersianDate(request.created_at)}</span>
                </div>
              </div>
            </div>

            {request.suggested_xp && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 flex items-center gap-1.5 self-start">
                <Sparkles className="w-3.5 h-3.5" />
                <span>پیشنهاد عضو: {toPersianDigits(request.suggested_xp)} XP</span>
              </div>
            )}
          </div>

          {/* Submitted Request Info */}
          <div className="border-t border-border/70 pt-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-xs text-muted ml-1">عنوان ارسالی عضو:</span>
                <span className="text-sm font-semibold text-default">{request.title}</span>
              </div>

              {/* Requester Chosen Project Badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted">پروژه ارسالی:</span>
                {request.project ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-xs font-bold text-action border border-border shadow-2xs">
                    <FolderKanban className="w-3 h-3 text-action" />
                    <span>{request.project.name}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface/70 px-2 py-0.5 text-[11px] text-muted border border-border/60">
                    فعالیت عمومی (بدون پروژه)
                  </span>
                )}
              </div>
            </div>

            {request.description && (
              <div className="mt-1.5 text-xs text-subtle bg-surface/80 rounded-xl p-2.5 border border-border/60 leading-relaxed whitespace-pre-wrap">
                {request.description}
              </div>
            )}
          </div>
        </div>

        {/* Main Review Form */}
        {isRejecting ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>رد درخواست امتیاز</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              آیا از رد این درخواست اطمینان دارید؟ در صورت نیاز می‌توانید دلیل رد را برای اطلاع عضو بنویسید:
            </p>
            <textarea
              rows={2}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="دلیل رد درخواست (اختیاری: مثلاً تسک ناقص تحویل شده یا قبلاً امتیاز آن محاسبه شده است)..."
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs sm:text-sm text-default focus:border-rose-500 focus:outline-none resize-none"
            />
            {error && <div className="text-xs text-rose-500 font-semibold">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="rounded-xl px-3.5 py-1.5 text-xs text-muted hover:bg-surface-2 transition-colors cursor-pointer"
              >
                بازگشت
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleReject}
                className="rounded-xl bg-danger hover:bg-danger-hover text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? 'در حال رد درخواست...' : 'تایید و رد درخواست'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApprove} className="mt-5 space-y-4">
            {/* 1. Final Task Name (اسم تسک) */}
            <div>
              <label className="block text-xs font-bold text-default mb-1.5">
                ۱. نام تسک / عنوان تاییدشده <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={finalTaskName}
                onChange={(e) => setFinalTaskName(e.target.value)}
                placeholder="عنوان دقیق تسک را مشخص یا ویرایش کنید..."
                required
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20"
              />
              <span className="text-[11px] text-muted mt-1 block">
                این عنوان در سوابق امتیازات و کارنامه عضو درج خواهد شد.
              </span>
            </div>

            {/* 2. Project Selection (پروژه مرتبط - اختیاری با امکان ویرایش توسط راهبر) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-default flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-action" />
                  <span>۲. پروژه مرتبط با این تسک</span>
                  <span className="text-[11px] font-normal text-muted">(اختیاری)</span>
                </label>
                <span className="text-[10px] text-muted">
                  تعیین یا تغییر توسط راهبر
                </span>
              </div>

              {loadingProjects ? (
                <div className="h-10 w-full rounded-xl bg-surface-2 animate-pulse border border-border" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20 cursor-pointer pl-9"
                  >
                    <option value="" className="bg-surface text-default">بدون پروژه مشخص (فعالیت یا تسک عمومی)</option>
                    {allProjects.map((p) => {
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
              )}
              <span className="text-[11px] text-muted mt-1 block">
                با انتخاب پروژه، این تسک مستقیماً در ستون «انجام شده» بورد کانبان پروژه و در لیست کارهای خاتمه‌یافته عضو درج خواهد شد.
              </span>
            </div>

            {/* 3. Award Type (نوع امتیاز: تسک یا تشویقی) */}
            <div>
              <label className="block text-xs font-bold text-default mb-1.5">
                ۳. نوع تخصیص امتیاز <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAwardType('task_completion')}
                  className={`flex items-center justify-center gap-2 rounded-xl p-3 border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    awardType === 'task_completion'
                      ? 'border-action bg-action/10 text-action shadow-2xs'
                      : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-default'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تکمیل تسک موظف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAwardType('reward')}
                  className={`flex items-center justify-center gap-2 rounded-xl p-3 border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    awardType === 'reward'
                      ? 'border-[#652D90] bg-[#652D90]/10 text-[#652D90] dark:text-[#C084FC] shadow-2xs'
                      : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-default'
                  }`}
                >
                  <Gift className="w-4 h-4" />
                  <span>پاداش تشویقی</span>
                </button>
              </div>
            </div>

            {/* 4. XP Amount (مقدار XP) */}
            <div>
              <label className="block text-xs font-bold text-default mb-1.5">
                ۴. مقدار امتیاز (XP) <span className="text-rose-500">*</span>
              </label>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quickXpChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAwardedXp(q)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer ${
                      awardedXp === q
                        ? 'border-amber-500 bg-amber-500/15 text-amber-500 shadow-2xs'
                        : 'border-border bg-surface-2 text-muted hover:border-border-strong hover:text-default'
                    }`}
                  >
                    +{toPersianDigits(q)} XP
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={awardedXp}
                  onChange={(e) => setAwardedXp(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 50"
                  required
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs sm:text-sm text-default transition-all focus:border-action/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-action/20 font-bold"
                />
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-muted pointer-events-none">
                  XP
                </span>
              </div>
            </div>

            {/* 5. Target Recipients (انتخاب افراد) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-default flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-action" />
                  <span>۵. افراد دریافت‌کننده امتیاز</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowMemberPicker(!showMemberPicker)}
                  className="text-xs font-bold text-action hover:underline cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>{showMemberPicker ? 'بستن لیست اعضا' : 'تغییر یا افزودن عضو'}</span>
                </button>
              </div>

              {/* Selected members badge list */}
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-border bg-surface-2/40 min-h-[44px] items-center">
                {selectedProfiles.map((sp) => (
                  <div
                    key={sp.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2 py-1 text-xs text-default shadow-2xs"
                  >
                    <UserAvatar
                      src={sp.avatar_url}
                      name={sp.full_name}
                      role={sp.role}
                      size="sm"
                      shape="circle"
                    />
                    <span className="font-semibold">{sp.full_name}</span>
                    {selectedUserIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleMember(sp.id)}
                        className="text-muted hover:text-rose-500 transition-colors cursor-pointer mr-0.5"
                        title="حذف از لیست"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-muted mt-1 block">
                امتیاز فوق به هر یک از {toPersianDigits(selectedUserIds.length)} عضو انتخاب‌شده به‌صورت کامل تعلق خواهد گرفت.
              </span>

              {/* Dropdown / Searchable Member Picker */}
              {showMemberPicker && (
                <div className="mt-2 rounded-2xl border border-border bg-surface p-3 shadow-lg space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="جستجوی نام عضو..."
                      className="w-full rounded-xl border border-border bg-surface-2 pr-8 pl-3 py-1.5 text-xs text-default focus:border-action focus:outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                    {filteredMembers.map((m) => {
                      const isSelected = selectedUserIds.includes(m.id)
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleMember(m.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-action/10 border border-action/30 text-default'
                              : 'hover:bg-surface-2 text-muted hover:text-default'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={m.avatar_url}
                              name={m.full_name}
                              role={m.role}
                              size="sm"
                              shape="circle"
                            />
                            <span className="font-semibold">{m.full_name}</span>
                            <span className="text-[10px] text-muted">({toPersianDigits(m.xp_total)} XP)</span>
                          </div>
                          <div className={`h-4 w-4 rounded flex items-center justify-center border ${
                            isSelected ? 'bg-action border-action text-white' : 'border-border'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 6. Reviewer Note (اختیاری) */}
            <div>
              <label className="block text-xs font-semibold text-default mb-1.5">
                ۶. یادداشت یا بازخورد به عضو <span className="text-[11px] font-normal text-muted">(اختیاری)</span>
              </label>
              <textarea
                rows={2}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder="توضیح کوتاه یا پیام تشکر به عضو..."
                className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs sm:text-sm text-default focus:border-action/60 focus:bg-surface focus:outline-none resize-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-500 font-semibold">
                {error}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                رد درخواست
              </button>

              <div className="flex items-center gap-2">
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
                  className="rokad-btn-primary min-w-[150px] px-5 py-2.5 text-xs sm:text-sm shadow-xs disabled:opacity-50"
                >
                  {loading ? (
                    <span>در حال ثبت...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تایید و اعطای امتیاز ({toPersianDigits(Number(awardedXp) || 0)} XP)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
