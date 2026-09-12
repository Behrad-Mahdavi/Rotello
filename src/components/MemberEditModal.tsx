'use client'

import { useState, useEffect } from 'react'
import { DEPARTMENTS, DEPARTMENT_KEYS, type DepartmentKey, type DepartmentLevel } from '@/constants/departments'
import type { Profile, Role, MemberDepartment } from '@/utils/database.types'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Pencil, X, Crown } from 'lucide-react'

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
