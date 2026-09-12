'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import PersianDatePicker from '@/components/PersianDatePicker'
import { formatToPersianDate } from '@/utils/jalaali'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS, type DepartmentKey } from '@/constants/departments'
import type { Project, Profile } from '@/utils/database.types'
import EditProjectModal from '@/components/EditProjectModal'
import DeleteProjectModal from '@/components/DeleteProjectModal'
import ProjectMembersModal from '@/components/ProjectMembersModal'
import { Zap, Users } from 'lucide-react'

export default function AdminProjectsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectXps, setProjectXps] = useState<Record<string, number>>({})
  const [projectMembersMap, setProjectMembersMap] = useState<Record<string, string[]>>({})
  const [projectForMembers, setProjectForMembers] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [department, setDepartment] = useState<string>('')
  const [error, setError] = useState('')
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin') { router.push('/projects'); return }
      setProfile(prof)
      const [projRes, tasksRes, mapRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('project_id, xp_value, title'),
        fetch('/api/projects/members-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
      ])
      if (projRes.data) setProjects(projRes.data)
      if (mapRes?.map) setProjectMembersMap(mapRes.map)
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
    const [projRes, tasksRes, mapRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('project_id, xp_value, title'),
      fetch('/api/projects/members-map').then((r) => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
    ])
    if (projRes.data) setProjects(projRes.data)
    if (mapRes?.map) setProjectMembersMap(mapRes.map)
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

    const insertData: Record<string, unknown> = {
      name,
      description: description || null,
      deadline: deadline || null,
      created_by: user.id,
      department: department || null,
    }

    let { error: err } = await supabase.from('projects').insert(insertData)
    if (err && err.message?.includes('department')) {
      delete insertData.department
      const fallback = await supabase.from('projects').insert(insertData)
      err = fallback.error
    }

    if (err) { setError(err.message); setLoading(false); return }
    setName(''); setDescription(''); setDeadline(''); setDepartment(''); setShowForm(false)
    await reload()
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
              <div>
                <label className="block text-xs font-semibold text-subtle">دپارتمان مربوطه (اختیاری)</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default transition-all focus:border-action focus:bg-surface focus:outline-none"
                >
                  <option value="">عمومی / بدون دپارتمان خاص (برای همه)</option>
                  <option value="engineers">مهندسا</option>
                  <option value="artists">آرتیستا</option>
                  <option value="generalists">آچارفرانسه‌ها</option>
                </select>
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
            const gradients = [
              'from-emerald-500 to-teal-600',
              'from-rose-500 to-pink-600',
              'from-amber-500 to-orange-600',
              'from-violet-500 to-purple-600',
              'from-teal-500 to-cyan-600',
              'from-orange-500 to-red-600',
            ]
            const g = gradients[i % gradients.length]
            const depConfig = project.department && (project.department in DEPARTMENTS)
              ? DEPARTMENTS[project.department as DepartmentKey]
              : null

            return (
              <div key={project.id} className="group relative overflow-hidden rounded-2xl border border-border bg-surface pt-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-border-subtle">
                <div className={`h-2 w-full bg-gradient-to-r ${g}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${g} text-white text-base font-bold shadow-sm`}>
                        {project.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-default text-sm sm:text-base">{project.name}</h3>
                      </div>
                    </div>

                    {depConfig ? (
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${depConfig.badgeClass}`}>
                        {depConfig.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                        عمومی
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-muted sm:text-sm leading-relaxed">
                    {project.description || 'بدون توضیحات'}
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
                      <button onClick={() => router.push(`/projects/${project.id}/board`)}
                        className="rounded-xl bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer active:scale-95 shadow-sm">
                        مشاهده بورد ←
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-[#F8A41D]/30 bg-[#FEF6E8] dark:bg-[#57390A]/40 px-2 py-1 text-[11px] font-black text-[#BA7B16] dark:text-[#fde047]">
                        <Zap className="h-3 w-3 text-[#F8A41D]" />
                        <span>{(projectXps[project.id] || 0).toLocaleString('fa-IR')} XP</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setProjectForMembers(project)}
                        className="rounded-xl bg-action/10 hover:bg-action hover:text-white border border-action/30 px-2.5 py-1.5 text-xs font-semibold text-action transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                        title="مدیریت اعضای پروژه"
                      >
                        <Users className="h-3 w-3" />
                        <span>اعضا ({projectMembersMap[project.id]?.length || 0})</span>
                      </button>
                      <button
                        onClick={() => setProjectToEdit(project)}
                        className="rounded-xl bg-surface-2 hover:bg-accent/15 hover:text-accent border border-border px-2.5 py-1.5 text-xs font-medium text-default transition-colors cursor-pointer active:scale-95"
                        title="ویرایش پروژه"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
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
