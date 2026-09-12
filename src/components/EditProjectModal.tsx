'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import PersianDatePicker from './PersianDatePicker'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS } from '@/constants/departments'
import type { Project } from '@/utils/database.types'
import { Pencil, X } from 'lucide-react'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  onProjectUpdated: (updatedProject: Project) => void
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
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '')
      setDescription(project.description || '')
      setDeadline(project.deadline ? project.deadline.split('T')[0] : '')
      setDepartment(project.department || '')
      setError('')
    }
  }, [project, isOpen])

  if (!isOpen || !project) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('نام پروژه الزامی است.')
      return
    }

    setLoading(true)
    setError('')

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      deadline: deadline || null,
      department: department || null,
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

    if (updateErr) {
      console.error('Error updating project:', updateErr)
      setError(updateErr.message || 'خطا در ویرایش پروژه')
      setLoading(false)
      return
    }

    if (updated) {
      onProjectUpdated(updated as Project)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain rounded-3xl border-[1.5px] border-border bg-surface p-6 sm:p-7 shadow-[4px_4px_0_#202A5A] dark:shadow-[4px_4px_0_#59BBAF] text-right animate-in zoom-in-95 duration-150"
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
              <p className="text-xs text-muted font-medium mt-0.5">اصلاح مشخصات، دپارتمان و مهلت پروژه</p>
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
              rows={3}
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

          <div>
            <label className="block text-xs font-bold text-default mb-1.5">
              دپارتمان مربوطه
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-medium text-default transition-all focus:border-action focus:bg-surface focus:outline-none cursor-pointer"
            >
              <option value="">عمومی (بدون دپارتمان خاص)</option>
              <option value="engineers">{DEPARTMENTS.engineers.label}</option>
              <option value="artists">{DEPARTMENTS.artists.label}</option>
              <option value="generalists">{DEPARTMENTS.generalists.label}</option>
            </select>
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
