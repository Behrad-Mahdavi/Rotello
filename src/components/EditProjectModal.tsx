'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import PersianDatePicker from './PersianDatePicker'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS, DEPARTMENT_KEYS, type DepartmentKey } from '@/constants/departments'
import {
  PROJECT_COLORS,
  PROJECT_COLOR_KEYS,
  type ProjectColorKey,
  extractProjectColorKey,
  cleanProjectDescription,
} from '@/constants/projectColors'
import type { Project } from '@/utils/database.types'
import { Pencil, X, Check, Globe, Building2, Palette } from 'lucide-react'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  onProjectUpdated: (updatedProject: Project, updatedDepartments?: DepartmentKey[]) => void
}

export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: EditProjectModalProps) {
  useBodyScrollLock(isOpen)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [departments, setDepartments] = useState<DepartmentKey[]>([])
  const [color, setColor] = useState<ProjectColorKey>('emerald')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '')
      setDescription(cleanProjectDescription(project.description))
      setDeadline(project.deadline ? project.deadline.split('T')[0] : '')
      setError('')

      // Parse color from project description
      const parsedColor = extractProjectColorKey(project.description)
      setColor(parsedColor || 'emerald')

      // 1. Synchronous initial parse from project metadata to prevent empty flicker
      const initialDeps: DepartmentKey[] = []
      const match = (project.description || '').match(/\[DEPS:([^\]]+)\]/)
      if (match && match[1]) {
        const parsed = match[1]
          .split(',')
          .map((d: string) => d.trim() as DepartmentKey)
          .filter((d) => DEPARTMENT_KEYS.includes(d))
        initialDeps.push(...parsed)
      } else if (project.department && DEPARTMENT_KEYS.includes(project.department as DepartmentKey)) {
        initialDeps.push(project.department as DepartmentKey)
      }
      setDepartments(initialDeps)

      // 2. Fetch fresh departments from API in background to ensure latest server state
      fetch(`/api/projects/${project.id}/departments`)
        .then((r) => (r.ok ? r.json() : { departments: [] }))
        .then((data) => {
          if (data.departments && Array.isArray(data.departments)) {
            setDepartments(data.departments)
          }
        })
        .catch(() => {})
    }
  }, [project, isOpen])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !project) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('نام پروژه الزامی است.')
      return
    }

    setLoading(true)
    setError('')

    // Construct final description embedding [COLOR:...] and [DEPS:...] tags
    let finalDesc = description.trim()
    if (color) {
      finalDesc = finalDesc ? `${finalDesc} [COLOR:${color}]` : `[COLOR:${color}]`
    }
    if (departments.length > 0) {
      finalDesc = `${finalDesc} [DEPS:${departments.join(',')}]`
    }

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      description: finalDesc || null,
      deadline: deadline || null,
      department: departments[0] || null,
    }

    let { data: updated, error: updateErr } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', project!.id)
      .select()
      .single()

    if (updateErr && updateErr.message?.includes('department')) {
      delete updatePayload.department
      const fallback = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', project!.id)
        .select()
        .single()
      updated = fallback.data
      updateErr = fallback.error
    }

    // Persist multi-departments in store
    try {
      await fetch(`/api/projects/${project!.id}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments }),
      })
    } catch (deptErr) {
      console.error('Error saving multi-departments:', deptErr)
    }

    if (updateErr) {
      console.error('Error updating project:', updateErr)
      setError(updateErr.message || 'خطا در ویرایش پروژه')
      setLoading(false)
      return
    }

    if (updated) {
      onProjectUpdated(updated as Project, departments)
      onClose()
    }
    setLoading(false)
  }

  const isGeneral = departments.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl border-[1.5px] border-border bg-surface p-5 sm:p-7 shadow-[4px_4px_0_#202A5A] dark:shadow-[4px_4px_0_#59BBAF] text-right animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-action/15 text-action border border-action/30 shadow-xs">
              <Pencil className="w-5 h-5 text-action" />
            </div>
            <div>
              <h3 className="text-base font-black text-default">ویرایش پروژه</h3>
              <p className="text-xs text-muted font-medium mt-0.5">اصلاح مشخصات، دپارتمان‌ها و مهلت پروژه</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-2 hover:text-default transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-500">
            {error}
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              نام پروژه <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="عنوان پروژه..."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-medium text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              توضیحات پروژه (اختیاری)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="توضیح مختصر درباره اهداف پروژه..."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-medium text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              مهلت تحویل یا پایان پروژه
            </label>
            <PersianDatePicker value={deadline} onChange={setDeadline} />
          </div>

          {/* Project Accent Color Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-action" />
                <label className="text-xs font-bold text-default">
                  رنگ شاخص پروژه
                </label>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-border bg-surface-2 text-default flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-xs"
                  style={{ backgroundColor: PROJECT_COLORS[color].hex }}
                />
                <span>{PROJECT_COLORS[color].label}</span>
              </span>
            </div>

            {/* Color Swatches Grid */}
            <div className="grid grid-cols-6 gap-2 pt-0.5">
              {PROJECT_COLOR_KEYS.map((key) => {
                const conf = PROJECT_COLORS[key]
                const isSelected = color === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    title={conf.label}
                    className={`group relative flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer touch-manipulation min-h-[50px] ${
                      isSelected
                        ? `border-default/40 bg-surface ring-2 ring-offset-2 ${conf.ring} scale-105 shadow-sm`
                        : 'border-border bg-surface-2/60 hover:border-border-strong hover:bg-surface hover:scale-[1.02]'
                    }`}
                  >
                    <div
                      className={`h-6 w-6 rounded-xl bg-gradient-to-br ${conf.badge} flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-[9px] font-semibold text-muted mt-1 truncate max-w-full">
                      {conf.label.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Department Selection Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-action" />
                <label className="text-xs font-bold text-default">
                  دپارتمان‌های مسئول پروژه
                </label>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                isGeneral
                  ? 'border-border bg-surface-2 text-muted'
                  : 'border-action/40 bg-action/10 text-action'
              }`}>
                {isGeneral ? 'پروژه عمومی' : `${departments.length} از ۳ دپارتمان`}
              </span>
            </div>

            {/* General / Public Option */}
            <button
              type="button"
              onClick={() => setDepartments([])}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-right transition-all cursor-pointer touch-manipulation min-h-[50px] ${
                isGeneral
                  ? 'border-action/60 bg-action/10 text-default ring-2 ring-offset-1 ring-action/40 shadow-xs'
                  : 'border-border bg-surface-2/50 text-muted hover:border-border-strong hover:text-default'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${
                    isGeneral
                      ? 'border-action/40 bg-action text-white shadow-xs'
                      : 'border-border bg-surface text-muted'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-default">پروژه عمومی (همه دپارتمان‌ها)</span>
                    {isGeneral && (
                      <span className="rounded-md bg-action/20 text-action px-1.5 py-0.2 text-[10px] font-black">
                        فعال
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted font-normal mt-0.5 truncate">
                    دسترسی آزاد برای اعضای تمام حوزه‌ها بدون تفکیک دپارتمانی
                  </p>
                </div>
              </div>
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all mr-2 ${
                  isGeneral ? 'border-action bg-action text-white' : 'border-border bg-surface'
                }`}
              >
                {isGeneral && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            </button>

            {/* Specific Department Toggle Cards */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted px-1">
                <span>یا انتخاب دپارتمان‌های خاص:</span>
                {departments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (departments.length === DEPARTMENT_KEYS.length) {
                        setDepartments([])
                      } else {
                        setDepartments([...DEPARTMENT_KEYS])
                      }
                    }}
                    className="text-[10px] font-bold text-action hover:underline cursor-pointer"
                  >
                    {departments.length === DEPARTMENT_KEYS.length ? 'حالت عمومی' : 'انتخاب همه دپارتمان‌ها'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEPARTMENT_KEYS.map((key) => {
                  const dep = DEPARTMENTS[key]
                  const isSelected = departments.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDepartments((prev) =>
                          prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
                        )
                      }}
                      className={`relative flex items-center sm:flex-col justify-between sm:justify-center p-3 sm:p-2.5 rounded-2xl border text-right sm:text-center transition-all cursor-pointer touch-manipulation min-h-[50px] ${
                        isSelected
                          ? `${dep.badgeClass} ring-2 ring-offset-1 ring-action/50 shadow-xs scale-[1.01]`
                          : 'border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-default'
                      }`}
                    >
                      <div className="flex items-center sm:flex-col gap-2.5 sm:gap-1 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: dep.dotColor }}
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-bold truncate">{dep.label}</span>
                          <span className="block text-[10px] font-normal opacity-80 truncate">{dep.shortLabel}</span>
                        </div>
                      </div>

                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border sm:mt-1.5 transition-all ${
                          isSelected
                            ? 'border-current bg-current/20 text-current'
                            : 'border-border bg-surface text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center gap-2.5 pt-4 border-t border-border mt-5">
            <button
              type="submit"
              disabled={loading}
              className="rokad-btn-primary flex-1 py-2.5 text-xs sm:text-sm font-bold justify-center disabled:opacity-50"
            >
              {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-muted hover:text-default transition cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
