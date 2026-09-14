'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import PersianDatePicker from '@/components/PersianDatePicker'
import { formatToPersianDate } from '@/utils/jalaali'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS, DEPARTMENT_KEYS, type DepartmentKey } from '@/constants/departments'
import {
  PROJECT_COLORS,
  PROJECT_COLOR_KEYS,
  type ProjectColorKey,
  getProjectColor,
  cleanProjectDescription,
} from '@/constants/projectColors'
import type { Project, Profile } from '@/utils/database.types'
import EditProjectModal from '@/components/EditProjectModal'
import DeleteProjectModal from '@/components/DeleteProjectModal'
import ProjectMembersModal from '@/components/ProjectMembersModal'
import { Zap, Users, Globe, Building2, Check, Loader2, Palette } from 'lucide-react'

export default function AdminProjectsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectXps, setProjectXps] = useState<Record<string, number>>({})
  const [projectMembersMap, setProjectMembersMap] = useState<Record<string, string[]>>({})
  const [projectDepartmentsMap, setProjectDepartmentsMap] = useState<Record<string, DepartmentKey[]>>({})
  const [projectForMembers, setProjectForMembers] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [departments, setDepartments] = useState<DepartmentKey[]>([])
  const [color, setColor] = useState<ProjectColorKey>('emerald')
  const [error, setError] = useState('')
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [navigatingProjectId, setNavigatingProjectId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleOpenProject = (projectId: string) => {
    setNavigatingProjectId(projectId)
    router.push(`/projects/${projectId}/board`)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/projects'); return }
      setProfile({
        ...(prof || { id: user.id, full_name: user.user_metadata?.full_name || 'مدیر', xp_total: 0, created_at: '' }),
        role: 'admin',
        avatar_url: prof?.avatar_url || user.user_metadata?.avatar_url || null,
      })
      const [projRes, tasksRes, mapRes, deptsMapRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('project_id, xp_value, title'),
        fetch('/api/projects/members-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
        fetch('/api/projects/departments-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
      ])
      if (projRes.data) setProjects(projRes.data)
      if (mapRes?.map) setProjectMembersMap(mapRes.map)
      if (deptsMapRes?.map) setProjectDepartmentsMap(deptsMapRes.map)
      if (tasksRes.data) {
        const xps: Record<string, number> = {}
        for (const t of tasksRes.data) {
          if (t.title === '__PROJECT_ROSTER__') continue
          if (t.project_id) {
            xps[t.project_id] = (xps[t.project_id] || 0) + (Number(t.xp_value) || 0)
          }
        }
        setProjectXps(xps)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const [projRes, tasksRes, mapRes, deptsMapRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('project_id, xp_value, title'),
      fetch('/api/projects/members-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
      fetch('/api/projects/departments-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
    ])
    if (projRes.data) setProjects(projRes.data)
    if (mapRes?.map) setProjectMembersMap(mapRes.map)
    if (deptsMapRes?.map) setProjectDepartmentsMap(deptsMapRes.map)
    if (tasksRes.data) {
      const xps: Record<string, number> = {}
      for (const t of tasksRes.data) {
        if (t.title === '__PROJECT_ROSTER__') continue
        if (t.project_id) {
          xps[t.project_id] = (xps[t.project_id] || 0) + (Number(t.xp_value) || 0)
        }
      }
      setProjectXps(xps)
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    let finalDesc = description.trim()
    if (color) {
      finalDesc = finalDesc ? `${finalDesc} [COLOR:${color}]` : `[COLOR:${color}]`
    }
    if (departments.length > 0) {
      finalDesc = `${finalDesc} [DEPS:${departments.join(',')}]`
    }

    const insertData: Record<string, unknown> = {
      name,
      description: finalDesc || null,
      deadline: deadline || null,
      created_by: user.id,
      department: departments[0] || null,
    }

    let { data: inserted, error: err } = await supabase.from('projects').insert(insertData).select().single()
    if (err && err.message?.includes('department')) {
      delete insertData.department
      const fallback = await supabase.from('projects').insert(insertData).select().single()
      inserted = fallback.data
      err = fallback.error
    }

    if (err) { setError(err.message); setLoading(false); return }

    if (inserted?.id && departments.length > 0) {
      try {
        await fetch(`/api/projects/${inserted.id}/departments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departments }),
        })
      } catch (deptErr) {
        console.error('Error setting project departments:', deptErr)
      }
    }

    setName(''); setDescription(''); setDeadline(''); setDepartments([]); setColor('emerald'); setShowForm(false)
    await reload()
    setLoading(false)
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
            <h2 className="text-lg font-bold text-default">پروژه‌ها</h2>
            <p className="text-sm text-muted">{projects.length} پروژه</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-action-hover active:scale-95 shadow-xs">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'لغو' : 'پروژه جدید'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateProject} className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-xs" dir="rtl">
            <h3 className="mb-3 text-sm font-bold text-default">ایجاد پروژه جدید</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-subtle">نام پروژه</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="mt-1 block w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-subtle">توضیحات</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="mt-1 block w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-subtle">مهلت پایان پروژه</label>
                <div className="mt-1">
                  <PersianDatePicker value={deadline} onChange={setDeadline} />
                </div>
              </div>

              {/* Project Accent Color */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-action" />
                    <label className="text-xs font-semibold text-subtle">رنگ شاخص پروژه</label>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border bg-surface-2 text-default flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_COLORS[color].hex }} />
                    <span>{PROJECT_COLORS[color].label}</span>
                  </span>
                </div>
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
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer touch-manipulation min-h-[44px] ${
                          isSelected
                            ? `border-default/40 bg-surface ring-2 ring-offset-2 ${conf.ring} scale-105 shadow-xs`
                            : 'border-border bg-surface-2/60 hover:border-border-strong hover:bg-surface hover:scale-[1.02]'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-lg bg-gradient-to-br ${conf.badge} flex items-center justify-center text-white shadow-2xs`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span className="text-[9px] font-medium text-muted mt-0.5 truncate max-w-full">
                          {conf.label.split(' ')[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Department Selection Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-action" />
                    <label className="text-xs font-semibold text-subtle">دپارتمان‌های مسئول پروژه</label>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    departments.length === 0
                      ? 'border-border bg-surface-2 text-muted'
                      : 'border-action/40 bg-action/10 text-action'
                  }`}>
                    {departments.length === 0 ? 'پروژه عمومی' : `${departments.length} از ۳ دپارتمان`}
                  </span>
                </div>

                {/* General / Public Option */}
                <button
                  type="button"
                  onClick={() => setDepartments([])}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all cursor-pointer touch-manipulation min-h-[46px] ${
                    departments.length === 0
                      ? 'border-action/60 bg-action/10 text-default ring-2 ring-offset-1 ring-action/40 shadow-xs'
                      : 'border-border bg-surface-2/50 text-muted hover:border-border-strong hover:text-default'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all ${
                      departments.length === 0 ? 'border-action/40 bg-action text-white' : 'border-border bg-surface text-muted'
                    }`}>
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-default">پروژه عمومی (همه دپارتمان‌ها)</span>
                      <p className="text-[10px] text-muted truncate mt-0.5">دسترسی آزاد برای تمام اعضا بدون تفکیک دپارتمانی</p>
                    </div>
                  </div>
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mr-2 ${
                    departments.length === 0 ? 'border-action bg-action text-white' : 'border-border bg-surface'
                  }`}>
                    {departments.length === 0 && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                </button>

                {/* Specific Department Toggle Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
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
                        className={`flex items-center sm:flex-col justify-between sm:justify-center p-2.5 sm:p-2 rounded-xl border text-right sm:text-center transition-all cursor-pointer touch-manipulation min-h-[46px] ${
                          isSelected
                            ? `${dep.badgeClass} ring-2 ring-offset-1 ring-action/50 shadow-xs scale-[1.01]`
                            : 'border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-default'
                        }`}
                      >
                        <div className="flex items-center sm:flex-col gap-2 sm:gap-1 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dep.dotColor }} />
                          <div className="min-w-0">
                            <span className="block text-xs font-bold truncate">{dep.label}</span>
                            <span className="block text-[10px] font-normal opacity-75 truncate">{dep.shortLabel}</span>
                          </div>
                        </div>
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border sm:mt-1 transition-all ${
                          isSelected ? 'border-current bg-current/20 text-current' : 'border-border bg-surface text-transparent'
                        }`}>
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              {error && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
              <button type="submit" disabled={loading}
                className="rounded-xl bg-action px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-action-hover active:scale-95 disabled:opacity-50 shadow-xs">
                {loading ? 'در حال ساخت...' : 'ساخت پروژه'}
              </button>
            </div>
          </form>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => {
            const colorConfig = getProjectColor(project.description, i)
            const assignedDepts: DepartmentKey[] = projectDepartmentsMap[project.id] ||
              (project.department && (project.department in DEPARTMENTS) ? [project.department as DepartmentKey] : [])

            return (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                onTouchStart={() => router.prefetch(`/projects/${project.id}/board`)}
                onMouseEnter={() => router.prefetch(`/projects/${project.id}/board`)}
                className={`group relative overflow-hidden rounded-2xl border-[1.5px] bg-surface pt-0 transition-all duration-100 touch-manipulation select-none cursor-pointer ${
                  navigatingProjectId === project.id
                    ? 'border-action ring-2 ring-action ring-offset-2 bg-action/[0.03] scale-[0.99] shadow-none'
                    : `border-border ${colorConfig.shadow} hover:-translate-y-1 ${colorConfig.shadowHover} hover:border-action/40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`
                }`}
              >
                <div className={`h-2 w-full bg-gradient-to-r ${colorConfig.bar}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorConfig.badge} text-white text-base font-bold shadow-sm`}>
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-default text-sm sm:text-base">{project.name}</h3>
                      </div>
                    </div>

                    {assignedDepts.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        {assignedDepts.map((dKey) => {
                          const depConfig = DEPARTMENTS[dKey]
                          if (!depConfig) return null
                          return (
                            <span key={dKey} className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${depConfig.badgeClass}`}>
                              {depConfig.label}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                        عمومی
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted sm:text-sm leading-relaxed">
                    {cleanProjectDescription(project.description) || 'بدون توضیحات'}
                  </p>
                  {project.deadline && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatToPersianDate(project.deadline)}</span>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenProject(project.id)
                        }}
                        className="rounded-xl bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer active:scale-95 shadow-sm flex items-center gap-1.5"
                      >
                        {navigatingProjectId === project.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                            <span>ورود...</span>
                          </>
                        ) : (
                          <span>مشاهده بورد ←</span>
                        )}
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-[#F8A41D]/30 bg-[#FEF6E8] dark:bg-[#57390A]/40 px-2 py-1 text-[11px] font-black text-[#BA7B16] dark:text-[#fde047]">
                        <Zap className="h-3 w-3 text-[#F8A41D]" />
                        <span>{(projectXps[project.id] || 0).toLocaleString('fa-IR')} XP</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setProjectForMembers(project)
                        }}
                        className="rounded-xl bg-action/10 hover:bg-action hover:text-white border border-action/30 px-2.5 py-1.5 text-xs font-semibold text-action transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                        title="مدیریت اعضای پروژه"
                      >
                        <Users className="h-3 w-3" />
                        <span>اعضا ({projectMembersMap[project.id]?.length || 0})</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setProjectToEdit(project)
                        }}
                        className="rounded-xl bg-surface-2 hover:bg-accent/15 hover:text-accent border border-border px-2.5 py-1.5 text-xs font-medium text-default transition-colors cursor-pointer active:scale-95"
                        title="ویرایش پروژه"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setProjectToDelete({ id: project.id, name: project.name })
                        }}
                        className="rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-600 hover:text-white cursor-pointer active:scale-95"
                        title="حذف پروژه"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            )
          })}
          {projects.length === 0 && (
            <div className="col-span-full rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">هیچ پروژه‌ای وجود ندارد.</div>
          )}
        </div>
      </main>

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={!!projectToEdit}
        project={projectToEdit}
        onClose={() => setProjectToEdit(null)}
        onProjectUpdated={reload}
      />

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={!!projectToDelete}
        projectId={projectToDelete?.id || null}
        projectName={projectToDelete?.name || ''}
        onClose={() => setProjectToDelete(null)}
        onProjectDeleted={reload}
      />

      {/* Project Members Modal */}
      {projectForMembers && (
        <ProjectMembersModal
          isOpen={!!projectForMembers}
          projectId={projectForMembers.id}
          projectName={projectForMembers.name}
          onClose={() => setProjectForMembers(null)}
          canManage={true}
          onMembersUpdated={() => reload()}
        />
      )}
    </div>
  )
}
