'use client'

import { useState, useEffect } from 'react'
import { DEPARTMENTS, DEPARTMENT_KEYS, type DepartmentKey, type DepartmentLevel } from '@/constants/departments'
import type { Profile, Role, MemberDepartment } from '@/utils/database.types'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Pencil, X, Crown, Camera, Trash2, Loader2 } from 'lucide-react'

interface MemberEditModalProps {
  isOpen: boolean
  member: Profile | null
  onClose: () => void
  onSuccess: (updated: Profile) => void
}

export default function MemberEditModal({
  isOpen,
  member,
  onClose,
  onSuccess,
}: MemberEditModalProps) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [selectedDepartments, setSelectedDepartments] = useState<Record<DepartmentKey, { enabled: boolean; level: DepartmentLevel }>>({
    engineers: { enabled: false, level: 'A' },
    artists: { enabled: false, level: 'A' },
    generalists: { enabled: false, level: 'A' },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (member) {
      setFullName(member.full_name || '')
      setRole(member.role || 'member')
      setAvatarUrl(member.avatar_url || null)

      const depState: Record<DepartmentKey, { enabled: boolean; level: DepartmentLevel }> = {
        engineers: { enabled: false, level: 'A' },
        artists: { enabled: false, level: 'A' },
        generalists: { enabled: false, level: 'A' },
      }

      if (member.departments && Array.isArray(member.departments)) {
        for (const d of member.departments) {
          if (d && d.department && depState[d.department]) {
            depState[d.department] = {
              enabled: true,
              level: d.level === 'B' ? 'B' : 'A',
            }
          }
        }
      }

      setSelectedDepartments(depState)
      setError('')
    }
  }, [member])

  async function handleAvatarUpload(file: File) {
    if (!member) return
    if (!file.type.startsWith('image/')) {
      alert('لطفاً یک فایل تصویری انتخاب کنید.')
      return
    }

    setUploadingAvatar(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new window.Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const size = Math.min(img.width, img.height)
            const targetSize = 256
            canvas.width = targetSize
            canvas.height = targetSize
            const ctx = canvas.getContext('2d')
            if (!ctx) return reject(new Error('Canvas context unavailable'))
            const startX = (img.width - size) / 2
            const startY = (img.height - size) / 2
            ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize)
            resolve(canvas.toDataURL('image/jpeg', 0.88))
          }
          img.onerror = () => reject(new Error('خطا در پردازش تصویر'))
          img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error('خطا در خواندن فایل'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          avatarUrl: dataUrl,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'خطا در ثبت عکس پروفایل')
      }

      setAvatarUrl(json.avatar_url)
      onSuccess({
        ...member,
        avatar_url: json.avatar_url,
      })
      window.dispatchEvent(new Event('profile-updated'))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'خطا در آپلود عکس')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!member || !avatarUrl) return
    if (!confirm('آیا از حذف عکس پروفایل اطمینان دارید؟')) return

    setUploadingAvatar(true)
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.id,
          avatarUrl: null,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'خطا در حذف عکس')
      }

      setAvatarUrl(null)
      onSuccess({
        ...member,
        avatar_url: null,
      })
      window.dispatchEvent(new Event('profile-updated'))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'خطا در حذف عکس')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (!isOpen || !member) return null

  function toggleDepartment(key: DepartmentKey) {
    setSelectedDepartments((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key].enabled,
      },
    }))
  }

  function setDepartmentLevel(key: DepartmentKey, level: DepartmentLevel) {
    setSelectedDepartments((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        level,
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return

    setLoading(true)
    setError('')

    const departments: MemberDepartment[] = role === 'admin'
      ? []
      : DEPARTMENT_KEYS
          .filter((k) => selectedDepartments[k].enabled)
          .map((k) => ({
            department: k,
            level: role === 'mentor' ? 'A' : selectedDepartments[k].level,
          }))

    try {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: member.id,
          full_name: fullName.trim() || member.full_name,
          role,
          departments,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ویرایش اطلاعات عضو')
      }

      onSuccess({
        ...member,
        full_name: fullName.trim() || member.full_name,
        role,
        departments,
        avatar_url: avatarUrl,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته رخ داد')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-action/10 text-action">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-default">ویرایش اطلاعات و دسترسی‌های عضو</h3>
              <p className="text-xs text-muted mt-0.5">{member.email || member.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-default transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar Edit Section for Admins */}
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-border/80 bg-surface-2/60 p-4 mb-5">
          <div className="relative group shrink-0">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white shadow-md overflow-hidden bg-gradient-to-br border-2 border-border/80 ${
                role === 'admin'
                  ? 'from-purple-600 to-indigo-700'
                  : role === 'mentor'
                  ? 'from-[#3B82F6] to-[#1D4ED8]'
                  : 'from-[#59BBAF] to-[#202A5A]'
              }`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName || member.full_name} className="h-full w-full object-cover" />
              ) : (
                <span>{(fullName || member.full_name)?.charAt(0) || '؟'}</span>
              )}
            </div>

            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-right min-w-0">
            <div className="text-xs font-bold text-default">عکس پروفایل کاربر</div>
            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
              شما به عنوان راهبر می‌توانید عکس پروفایل این کاربر را آپلود، تغییر یا حذف کنید.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <label
                htmlFor="admin-member-avatar-input"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-action px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-action-hover active:scale-95 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{avatarUrl ? 'تغییر عکس' : 'آپلود عکس'}</span>
                <input
                  id="admin-member-avatar-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleAvatarUpload(file)
                    e.target.value = ''
                  }}
                  disabled={uploadingAvatar}
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف عکس</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-subtle mb-1">نام و نام خانوادگی</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm text-default transition-all focus:border-action focus:bg-surface focus:outline-none"
            />
          </div>

          {/* Role Selection (3-Tier) */}
          <div>
            <label className="block text-xs font-semibold text-subtle mb-1.5">نقش و سطح دسترسی</label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`cursor-pointer flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all text-center ${
                  role === 'member'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={role === 'member'}
                  onChange={() => setRole('member')}
                  className="sr-only"
                />
                <span className="text-sm">عضو</span>
                <span className="text-[10px] opacity-75 mt-0.5">پروژه‌های محول‌شده</span>
              </label>

              <label
                className={`cursor-pointer flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all text-center ${
                  role === 'mentor'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="mentor"
                  checked={role === 'mentor'}
                  onChange={() => setRole('mentor')}
                  className="sr-only"
                />
                <span className="text-sm">منتور</span>
                <span className="text-[10px] opacity-75 mt-0.5">دپارتمان و تسک‌ها</span>
              </label>

              <label
                className={`cursor-pointer flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all text-center ${
                  role === 'admin'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                    : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                  className="sr-only"
                />
                <span className="text-sm">راهبر</span>
                <span className="text-[10px] opacity-75 mt-0.5">دسترسی کامل سیستم</span>
              </label>
            </div>
          </div>

          {/* Departments & Levels Selection */}
          {role === 'admin' ? (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
              <Crown className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-300">
                راهبرها دسترسی کامل به تمامی پروژه‌ها و بخش‌ها دارند و نیازی به تعیین دپارتمان ندارند.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-subtle">
                  {role === 'mentor' ? 'دپارتمان‌های تحت منتورینگ (امکان انتخاب چند دپارتمان)' : 'دپارتمان‌ها و تعیین سطح (امکان انتخاب چند دپارتمان)'}
                </label>
                {role === 'member' && <span className="text-[11px] text-muted">سطح A یا B</span>}
              </div>

              <div className="space-y-2.5">
                {DEPARTMENT_KEYS.map((depKey) => {
                  const dep = DEPARTMENTS[depKey]
                  const isChecked = selectedDepartments[depKey].enabled
                  const currentLevel = selectedDepartments[depKey].level

                  return (
                    <div
                      key={depKey}
                      className={`rounded-xl border p-3 transition-all ${
                        isChecked
                          ? `${dep.borderClass} ${dep.bgClass}`
                          : 'border-border bg-surface-2/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Department Checkbox */}
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDepartment(depKey)}
                            className="h-4 w-4 rounded text-action focus:ring-action border-border"
                          />
                          <div>
                            <span className={`text-sm font-bold ${isChecked ? dep.textClass : 'text-default'}`}>
                              {dep.label}
                            </span>
                            <p className="text-[10px] text-muted">{dep.description}</p>
                          </div>
                        </label>

                        {/* Level Selection (A or B) - Only for members */}
                        {isChecked && role === 'member' && (
                          <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border shadow-xs">
                            <button
                              type="button"
                              onClick={() => setDepartmentLevel(depKey, 'A')}
                              className={`rounded-md px-2.5 py-1 text-xs font-black transition-all ${
                                currentLevel === 'A'
                                  ? 'bg-action text-white shadow-xs scale-105'
                                  : 'text-muted hover:text-default hover:bg-surface-2'
                              }`}
                            >
                              سطح A
                            </button>
                            <button
                              type="button"
                              onClick={() => setDepartmentLevel(depKey, 'B')}
                              className={`rounded-md px-2.5 py-1 text-xs font-black transition-all ${
                                currentLevel === 'B'
                                  ? 'bg-action text-white shadow-xs scale-105'
                                  : 'text-muted hover:text-default hover:bg-surface-2'
                              }`}
                            >
                              سطح B
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-xs text-danger border border-danger/20">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-action-hover active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {loading ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-default hover:bg-surface transition-colors"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
