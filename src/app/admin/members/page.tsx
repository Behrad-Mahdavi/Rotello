'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import MemberXpModal from '@/components/MemberXpModal'
import MemberProfileModal from '@/components/MemberProfileModal'
import MemberEditModal from '@/components/MemberEditModal'
import MemberTasksOverviewTab from '@/components/MemberTasksOverviewTab'
import type { MemberAssignmentItem } from '@/components/MemberTasksOverviewModal'
import TaskDetailModal from '@/components/TaskDetailModal'
import ReviewXpRequestModal from '@/components/ReviewXpRequestModal'
import UserAvatar from '@/components/UserAvatar'
import { formatToPersianDate, toPersianDigits } from '@/utils/jalaali'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS, DEPARTMENT_KEYS, getRoleInfo, type DepartmentKey, type DepartmentLevel } from '@/constants/departments'
import type { Profile, Role, MemberDepartment, XpRequest } from '@/utils/database.types'
import { Plus, Crown, X, Search, Pencil, Gift, AlertTriangle, Sparkles, CheckCircle2, Clock } from 'lucide-react'

type MemberAssignment = MemberAssignmentItem

type SortOption = 'xp_desc' | 'xp_asc' | 'name_asc' | 'date_desc' | 'date_asc'

export default function AdminMembersPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [assignments, setAssignments] = useState<MemberAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'members' | 'tasks' | 'requests'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'requests' || tab === 'tasks') return tab
    }
    return 'members'
  })
  const [showForm, setShowForm] = useState(false)
  const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState<string | null>(null)
  const [selectedMemberForXp, setSelectedMemberForXp] = useState<Profile | null>(null)
  const [xpModalTab, setXpModalTab] = useState<'reward' | 'penalty'>('reward')
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null)
  const [memberToEdit, setMemberToEdit] = useState<Profile | null>(null)
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingMember, setIsDeletingMember] = useState(false)

  // XP Requests state
  const [xpRequests, setXpRequests] = useState<XpRequest[]>([])
  const [loadingXpRequests, setLoadingXpRequests] = useState(false)
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<XpRequest | null>(null)
  const [xpRequestStatusFilter, setXpRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [xpRequestSearch, setXpRequestSearch] = useState('')

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('xp_desc')

  // Create member form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<Role>('member')
  const [newMemberDeps, setNewMemberDeps] = useState<Record<DepartmentKey, { enabled: boolean; level: DepartmentLevel }>>({
    engineers: { enabled: false, level: 'A' },
    artists: { enabled: false, level: 'A' },
    generalists: { enabled: false, level: 'A' },
  })
  const [formError, setFormError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useBodyScrollLock(!!memberToDelete || !!memberToEdit || !!selectedTaskIdForDetail)
  const router = useRouter()
  const supabase = createClient()

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'admin' && user.user_metadata?.role !== 'admin') {
        router.push('/projects')
        return
      }
      setProfile({
        ...(prof || { id: user.id, full_name: user.user_metadata?.full_name || 'مدیر', xp_total: 0, created_at: '' }),
        role: 'admin',
        avatar_url: prof?.avatar_url || user.user_metadata?.avatar_url || null,
      })

      const [membersRes, assignRes] = await Promise.all([
        fetch('/api/admin/members')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        supabase.from('task_assignees').select('user_id, tasks(id, title, status, deadline, xp_value, priority, project_id, projects(name))'),
      ])

      if (membersRes?.members) {
        setMembers(membersRes.members)
      } else {
        // Fallback to direct supabase query
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (data) setMembers(data)
      }

      if (assignRes?.data) setAssignments(assignRes.data as unknown as MemberAssignment[])
      await loadXpRequests()
    } catch (err) {
      console.error('Error loading members:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadXpRequests() {
    setLoadingXpRequests(true)
    try {
      const res = await fetch('/api/xp-requests').catch(() => null)
      if (res && res.ok) {
        const data = await res.json()
        if (data?.requests) {
          setXpRequests(data.requests)
        }
      }
    } catch (err) {
      console.warn('Error loading xp requests:', err)
    } finally {
      setLoadingXpRequests(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    void (async () => {
      await loadData()
    })()

    const handleReqCreated = () => {
      if (!isCancelled) {
        void loadXpRequests()
      }
    }
    window.addEventListener('xp-request-created', handleReqCreated)
    return () => {
      isCancelled = true
      window.removeEventListener('xp-request-created', handleReqCreated)
    }
  }, [])

  async function reload() {
    try {
      const res = await fetch('/api/admin/members').catch(() => null)
      const data = res && res.ok ? await res.json().catch(() => null) : null
      if (data?.members) {
        setMembers(data.members)
      } else {
        const { data: dbData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (dbData) setMembers(dbData)
      }
      const { data: assignData } = await supabase.from('task_assignees').select('user_id, tasks(id, title, status, deadline, xp_value, priority, project_id, projects(name))')
      if (assignData) setAssignments(assignData as unknown as MemberAssignment[])
      await loadXpRequests()
    } catch (err) {
      console.error('Reload error:', err)
    }
  }

  function handleOpenXpModal(m: Profile, type: 'reward' | 'penalty') {
    setSelectedMemberForXp(m)
    setXpModalTab(type)
  }

  function handleXpUpdated(userId: string, newXp: number) {
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, xp_total: newXp } : m))
    )
  }

  function handleRequestReviewed(updatedReq: XpRequest) {
    setXpRequests((prev) =>
      prev.map((r) => (r.id === updatedReq.id ? {
        ...r,
        ...updatedReq,
        requester: updatedReq.requester || r.requester,
      } : r))
    )
    reload()
    loadXpRequests()
    setSelectedRequestForReview(null)
  }

  function handleMemberUpdated(updated: Profile) {
    setMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
    )
  }

  async function confirmDeleteMember() {
    if (!memberToDelete) return
    setIsDeletingMember(true)
    const { error } = await supabase.from('profiles').delete().eq('id', memberToDelete.id)
    setIsDeletingMember(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setMemberToDelete(null)
    await reload()
  }

  function toggleNewMemberDep(key: DepartmentKey) {
    setNewMemberDeps((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  function setNewMemberDepLevel(key: DepartmentKey, level: DepartmentLevel) {
    setNewMemberDeps((prev) => ({
      ...prev,
      [key]: { ...prev[key], level },
    }))
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setIsCreating(true)

    const departments: MemberDepartment[] = newMemberRole === 'admin'
      ? []
      : DEPARTMENT_KEYS
          .filter((k) => newMemberDeps[k].enabled)
          .map((k) => ({
            department: k,
            level: newMemberRole === 'mentor' ? 'A' : newMemberDeps[k].level,
          }))

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: name,
          role: newMemberRole,
          departments,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ایجاد عضو جدید')

      setEmail('')
      setPassword('')
      setName('')
      setNewMemberRole('member')
      setNewMemberDeps({
        engineers: { enabled: false, level: 'A' },
        artists: { enabled: false, level: 'A' },
        generalists: { enabled: false, level: 'A' },
      })
      setShowForm(false)
      await reload()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsCreating(false)
    }
  }

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...members]

    // 1. Search Query (name or email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      )
    }

    // 2. Department Filter
    if (departmentFilter !== 'all') {
      if (departmentFilter === 'none') {
        result = result.filter((m) => !m.departments || m.departments.length === 0)
      } else {
        result = result.filter((m) =>
          m.departments?.some((d) => d.department === departmentFilter)
        )
      }
    }

    // 3. Level Filter
    if (levelFilter !== 'all') {
      result = result.filter((m) =>
        m.departments?.some((d) => d.level === levelFilter)
      )
    }

    // 4. Role Filter
    if (roleFilter !== 'all') {
      result = result.filter((m) => m.role === roleFilter)
    }

    // 5. Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'xp_desc':
          return (b.xp_total || 0) - (a.xp_total || 0)
        case 'xp_asc':
          return (a.xp_total || 0) - (b.xp_total || 0)
        case 'name_asc':
          return (a.full_name || '').localeCompare(b.full_name || '', 'fa')
        case 'date_desc':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'date_asc':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        default:
          return 0
      }
    })

    return result
  }, [members, searchQuery, departmentFilter, levelFilter, roleFilter, sortBy])

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        در حال بارگذاری اعضا...
      </div>
    </div>
  )
  if (!profile) return null

  return (
    <div className="flex min-h-screen flex-col bg-canvas" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-7">
        {/* Top Title & Header Actions */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-default">مدیریت اعضا و دسترسی‌ها</h2>
              <span className="rounded-full bg-action/10 border border-action/20 px-2.5 py-0.5 text-xs font-bold text-action">
                {toPersianDigits(members.length)} عضو
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'members' && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-action px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-action-hover active:scale-95 shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
                </svg>
                <span>{showForm ? 'بستن فرم' : 'عضو جدید'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="mb-6 flex border-b border-border/80">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'border-action text-action'
                : 'border-transparent text-muted hover:text-default'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>لیست اعضا و دسترسی‌ها</span>
            <span className={`rounded-full px-2 py-0.5 text-2xs font-extrabold ${
              activeTab === 'members' ? 'bg-action/15 text-action' : 'bg-surface-2 text-muted'
            }`}>
              {toPersianDigits(members.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-action text-action'
                : 'border-transparent text-muted hover:text-default'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>کارتابل و جزئیات تسک‌ها</span>
            <span className={`rounded-full px-2 py-0.5 text-2xs font-extrabold ${
              activeTab === 'tasks' ? 'bg-action/15 text-action' : 'bg-surface-2 text-muted'
            }`}>
              {toPersianDigits(assignments.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'requests'
                ? 'border-action text-action'
                : 'border-transparent text-muted hover:text-default'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>درخواست‌های امتیاز (XP)</span>
            {xpRequests.filter((r) => r.status === 'pending').length > 0 ? (
              <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-black shadow-xs animate-pulse">
                {toPersianDigits(xpRequests.filter((r) => r.status === 'pending').length)} جدید
              </span>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-2xs font-extrabold ${
                activeTab === 'requests' ? 'bg-action/15 text-action' : 'bg-surface-2 text-muted'
              }`}>
                {toPersianDigits(xpRequests.length)}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Members List & Access */}
        {activeTab === 'members' && (
          <>
            {/* Create Member Accordion Form */}
            {showForm && (
          <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm transition-all animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-action/10 text-action">
                <Plus className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-default">ساخت حساب کاربری عضو جدید</h3>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-subtle mb-1">نام و نام خانوادگی</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="مثال: علی رضایی"
                    className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default transition-all focus:border-action focus:bg-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-subtle mb-1">ایمیل سازمانی</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@rokad.ir"
                    className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default transition-all focus:border-action focus:bg-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-subtle mb-1">رمز عبور اولیه</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="حداقل ۶ کاراکتر"
                    className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 text-sm text-default transition-all focus:border-action focus:bg-surface focus:outline-none"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-subtle mb-1.5">نقش کاربر</label>
                <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                  <label
                    className={`cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-bold transition-all ${
                      newMemberRole === 'member'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newMemberRole"
                      value="member"
                      checked={newMemberRole === 'member'}
                      onChange={() => setNewMemberRole('member')}
                      className="sr-only"
                    />
                    <span>عضو</span>
                  </label>

                  <label
                    className={`cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-bold transition-all ${
                      newMemberRole === 'mentor'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newMemberRole"
                      value="mentor"
                      checked={newMemberRole === 'mentor'}
                      onChange={() => setNewMemberRole('mentor')}
                      className="sr-only"
                    />
                    <span>منتور</span>
                  </label>

                  <label
                    className={`cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-bold transition-all ${
                      newMemberRole === 'admin'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'border-border bg-surface-2/40 text-muted hover:bg-surface-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="newMemberRole"
                      value="admin"
                      checked={newMemberRole === 'admin'}
                      onChange={() => setNewMemberRole('admin')}
                      className="sr-only"
                    />
                    <span>راهبر</span>
                  </label>
                </div>
              </div>

              {/* Department & Level Selection */}
              {newMemberRole === 'admin' ? (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
                  <Crown className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-300">
                    راهبرها دسترسی کامل به تمامی بخش‌ها دارند و نیازی به تعیین دپارتمان ندارند.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-subtle mb-1.5">
                    {newMemberRole === 'mentor'
                      ? 'انتخاب دپارتمان‌های تحت منتورینگ (امکان انتخاب چند دپارتمان):'
                      : 'انتخاب دپارتمان‌ها و سطوح (امکان انتخاب چند دپارتمان):'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {DEPARTMENT_KEYS.map((depKey) => {
                      const dep = DEPARTMENTS[depKey]
                      const isChecked = newMemberDeps[depKey].enabled
                      const currentLevel = newMemberDeps[depKey].level

                      return (
                        <div
                          key={depKey}
                          className={`rounded-xl border p-3 transition-all ${
                            isChecked
                              ? `${dep.borderClass} ${dep.bgClass}`
                              : 'border-border bg-surface-2/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleNewMemberDep(depKey)}
                                className="h-4 w-4 rounded text-action focus:ring-action border-border"
                              />
                              <span className={`text-xs font-bold ${isChecked ? dep.textClass : 'text-default'}`}>
                                {dep.label}
                              </span>
                            </label>

                            {/* Level Selection (A or B) - Only for regular members */}
                            {isChecked && newMemberRole === 'member' && (
                              <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-border">
                                <button
                                  type="button"
                                  onClick={() => setNewMemberDepLevel(depKey, 'A')}
                                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                                    currentLevel === 'A'
                                      ? 'bg-action text-white shadow-xs'
                                      : 'text-muted hover:text-default'
                                  }`}
                                >
                                  A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewMemberDepLevel(depKey, 'B')}
                                  className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                                    currentLevel === 'B'
                                      ? 'bg-action text-white shadow-xs'
                                      : 'text-muted hover:text-default'
                                  }`}
                                >
                                  B
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

              {formError && (
                <div className="rounded-xl bg-danger-subtle px-3.5 py-2 text-xs text-danger border border-danger/20">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl bg-action px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-action-hover active:scale-95 disabled:opacity-50 shadow-xs"
                >
                  {isCreating ? 'در حال ایجاد حساب...' : 'ثبت و ساخت عضو'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-default hover:bg-surface transition-colors"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters and Sorting Bar */}
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام عضو یا ایمیل..."
                className="w-full rounded-xl border border-border bg-surface-2/60 py-2 pr-9 pl-8 text-xs sm:text-sm text-default placeholder:text-muted transition-all focus:border-action focus:bg-surface focus:outline-none"
              />
              <svg
                className="absolute right-3 top-2.5 h-4 w-4 text-muted pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2.5 text-xs text-muted hover:text-default cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Selects */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted hidden sm:inline">دپارتمان:</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="rounded-xl border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs font-semibold text-default focus:border-action focus:outline-none"
                >
                  <option value="all">همه دپارتمان‌ها</option>
                  <option value="engineers">مهندسا</option>
                  <option value="artists">آرتیستا</option>
                  <option value="generalists">آچارفرانسه‌ها</option>
                  <option value="none">بدون دپارتمان</option>
                </select>
              </div>

              {/* Level Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted hidden sm:inline">سطح:</span>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="rounded-xl border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs font-semibold text-default focus:border-action focus:outline-none"
                >
                  <option value="all">همه سطوح</option>
                  <option value="A">سطح A</option>
                  <option value="B">سطح B</option>
                </select>
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted hidden sm:inline">نقش:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs font-semibold text-default focus:border-action focus:outline-none"
                >
                  <option value="all">همه نقش‌ها</option>
                  <option value="admin">راهبر</option>
                  <option value="mentor">منتور</option>
                  <option value="member">عضو</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted hidden sm:inline">مرتب‌سازی:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-xl border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs font-semibold text-default focus:border-action focus:outline-none"
                >
                  <option value="xp_desc">بیشترین امتیاز (XP ↓)</option>
                  <option value="xp_asc">کمترین امتیاز (XP ↑)</option>
                  <option value="name_asc">نام (الف-ی)</option>
                  <option value="date_desc">جدیدترین عضویت</option>
                  <option value="date_asc">قدیمی‌ترین عضویت</option>
                </select>
              </div>

              {/* Reset Filters button if applied */}
              {(searchQuery || departmentFilter !== 'all' || levelFilter !== 'all' || roleFilter !== 'all' || sortBy !== 'xp_desc') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setDepartmentFilter('all')
                    setLevelFilter('all')
                    setRoleFilter('all')
                    setSortBy('xp_desc')
                  }}
                  className="rounded-xl bg-surface-2 px-2.5 py-1.5 text-xs text-muted hover:text-default transition-colors"
                  title="بازنشانی فیلترها"
                >
                  پاکسازی
                </button>
              )}
            </div>
          </div>

          {/* Results count info */}
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted">
            <span>
              نمایش {toPersianDigits(filteredAndSortedMembers.length)} از {toPersianDigits(members.length)} عضو
            </span>
            {(departmentFilter !== 'all' || levelFilter !== 'all' || roleFilter !== 'all' || searchQuery) && (
              <span className="font-medium text-action">فیلتر فعال است</span>
            )}
          </div>
        </div>

        {/* Members Grid */}
        {filteredAndSortedMembers.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
              <Search className="w-6 h-6 text-muted" />
            </div>
            <h4 className="text-sm font-bold text-default">هیچ عضوی با این مشخصات یافت نشد</h4>
            <p className="mt-1 text-xs text-muted">فیلترهای انتخابی یا عبارت جستجو را تغییر دهید.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedMembers.map((m) => {
              const roleInfo = getRoleInfo(m.role)
              const hasDepartments = m.departments && m.departments.length > 0

              return (
                <div
                  key={m.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-action/40"
                >
                  {/* Delete button (non-admin and non-self) */}
                  {m.role !== 'admin' && m.id !== profile.id && (
                    <button
                      onClick={() => setMemberToDelete({ id: m.id, name: m.full_name })}
                      className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/20"
                      title="حذف عضو"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}

                  {/* Header: Avatar, Name, Role Badge */}
                  <div>
                    <div className="flex items-start gap-3">
                      <div
                        onClick={() => setProfileModalUserId(m.id)}
                        className="cursor-pointer transition-transform hover:scale-105 shrink-0"
                        title="مشاهده کارنامه و پروفایل"
                      >
                        <UserAvatar
                          src={m.avatar_url}
                          name={m.full_name}
                          role={m.role}
                          size="lg"
                          shape="rounded"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            onClick={() => setProfileModalUserId(m.id)}
                            className="cursor-pointer truncate font-bold text-default hover:text-action transition-colors text-sm sm:text-base"
                            title="مشاهده کارنامه"
                          >
                            {m.full_name}
                          </h3>
                        </div>

                        {/* Role Badge */}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${roleInfo.colorClass}`}>
                            {roleInfo.label}
                          </span>
                          {m.email && (
                            <span className="truncate text-[10px] text-muted max-w-[120px] sm:max-w-[140px]" title={m.email}>
                              {m.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Departments & Levels Section */}
                    <div className="mt-3.5 pt-3 border-t border-border/60">
                      <div className="text-[11px] font-semibold text-subtle mb-1.5 flex items-center justify-between">
                        <span>دپارتمان‌ها:</span>
                        <button
                          type="button"
                          onClick={() => setMemberToEdit(m)}
                          className="text-[10px] font-bold text-action hover:underline cursor-pointer"
                        >
                          تغییر دپارتمان و نقش ←
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
                        {m.role === 'admin' ? (
                          <span className="inline-flex items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 text-[10px] font-semibold border border-purple-500/20">
                            دسترسی کامل (بدون نیاز به دپارتمان)
                          </span>
                        ) : hasDepartments ? (
                          m.departments!.map((dep) => {
                            const config = DEPARTMENTS[dep.department]
                            if (!config) return null
                            if (m.role === 'mentor') {
                              return (
                                <span
                                  key={dep.department}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${config.badgeClass}`}
                                >
                                  <span>منتور {config.label}</span>
                                </span>
                              )
                            }
                            return (
                              <span
                                key={dep.department}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${config.badgeClass}`}
                              >
                                <span>{config.label}</span>
                                <span className="rounded bg-surface/80 dark:bg-black/30 px-1 py-0.2 text-[9px] font-black">
                                  سطح {dep.level}
                                </span>
                              </span>
                            )
                          })
                        ) : (
                          <span className="inline-flex items-center rounded-lg bg-surface-2/80 px-2 py-0.5 text-[10px] text-muted">
                            بدون دپارتمان ثبت‌شده
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer: XP score and Action buttons */}
                  <div className="mt-4 pt-3 border-t border-border/60 space-y-2.5">
                    {/* XP Score Box - Only for members */}
                    {m.role === 'member' ? (
                      <div
                        onClick={() => setProfileModalUserId(m.id)}
                        className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2 text-xs cursor-pointer hover:bg-surface-2 transition-colors"
                        title="مشاهده کارنامه و سوابق امتیاز"
                      >
                        <span className="text-muted font-medium">امتیاز کل:</span>
                        <span className="font-extrabold text-amber-500 dark:text-amber-400 flex items-center gap-1">
                          <span>{toPersianDigits(m.xp_total || 0)} XP</span>
                          <span className="text-[10px] text-muted">کارنامه ←</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-surface-2/30 px-3 py-2 text-xs text-muted border border-border/50">
                        <span>امتیاز XP:</span>
                        <span className="font-medium text-[11px]">فاقد سیستم امتیازدهی ({roleInfo.label})</span>
                      </div>
                    )}

                    {/* Admin Action Buttons */}
                    {m.role === 'member' ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMemberToEdit(m)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2/80 py-1.5 text-xs font-semibold text-default transition-all hover:bg-surface hover:border-action/40 active:scale-95 shadow-2xs cursor-pointer"
                          title="ویرایش نام، نقش و دپارتمان‌ها"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted" />
                          <span>ویرایش</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenXpModal(m, 'reward')}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <Gift className="w-3.5 h-3.5 text-emerald-500" />
                          <span>تشویقی</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenXpModal(m, 'penalty')}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>جریمه</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() => setMemberToEdit(m)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2/80 py-2 text-xs font-semibold text-default transition-all hover:bg-surface hover:border-action/40 active:scale-95 shadow-2xs cursor-pointer"
                          title="ویرایش نام، نقش و دپارتمان‌ها"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted" />
                          <span>ویرایش نقش و اطلاعات</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    )}

        {/* Tab 2: Tasks Overview Tab */}
        {activeTab === 'tasks' && (
          <MemberTasksOverviewTab
            members={members}
            assignments={assignments}
            onOpenProfileModal={(uid) => setProfileModalUserId(uid)}
            onOpenTaskDetail={(tid) => setSelectedTaskIdForDetail(tid)}
          />
        )}

        {/* Tab 3: XP Requests Management Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* All */}
              <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs">
                <span className="text-xs font-semibold text-muted">کل درخواست‌ها</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-default">
                  {toPersianDigits(xpRequests.length)}
                </div>
              </div>

              {/* Pending */}
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-500">در انتظار تایید راهبر</span>
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-black text-amber-500">
                  {toPersianDigits(xpRequests.filter((r) => r.status === 'pending').length)}
                </div>
              </div>

              {/* Approved */}
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3.5 sm:p-4 shadow-2xs">
                <span className="text-xs font-bold text-emerald-500">تایید و واریز شده</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-500">
                  {toPersianDigits(xpRequests.filter((r) => r.status === 'approved').length)}
                </div>
              </div>

              {/* Rejected */}
              <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-4 shadow-2xs">
                <span className="text-xs font-semibold text-muted">رد شده</span>
                <div className="mt-1 text-xl sm:text-2xl font-black text-muted">
                  {toPersianDigits(xpRequests.filter((r) => r.status === 'rejected').length)}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3 shadow-2xs">
              {/* Status Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { key: 'all', label: 'همه' },
                  { key: 'pending', label: 'در انتظار بررسی' },
                  { key: 'approved', label: 'تایید شده' },
                  { key: 'rejected', label: 'رد شده' },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setXpRequestStatusFilter(st.key as typeof xpRequestStatusFilter)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      xpRequestStatusFilter === st.key
                        ? 'bg-action text-white shadow-xs'
                        : 'text-muted hover:text-default hover:bg-surface-2'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={xpRequestSearch}
                  onChange={(e) => setXpRequestSearch(e.target.value)}
                  placeholder="جستجوی نام عضو یا عنوان تسک..."
                  className="w-full rounded-xl border border-border bg-surface-2 pr-8 pl-3 py-1.5 text-xs text-default placeholder:text-muted/70 focus:border-action focus:bg-surface focus:outline-none"
                />
              </div>
            </div>

            {/* Requests List */}
            {loadingXpRequests ? (
              <div className="space-y-3 py-6 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-surface-2/70 border border-border" />
                ))}
              </div>
            ) : xpRequests.filter((r) => {
              if (xpRequestStatusFilter !== 'all' && r.status !== xpRequestStatusFilter) return false
              if (!xpRequestSearch.trim()) return true
              const q = xpRequestSearch.toLowerCase()
              const memberName = r.requester?.full_name?.toLowerCase() || ''
              const title = r.title?.toLowerCase() || ''
              const finalName = r.final_task_name?.toLowerCase() || ''
              return memberName.includes(q) || title.includes(q) || finalName.includes(q)
            }).length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-12 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-muted mx-auto" />
                <div className="text-sm font-bold text-default">هیچ درخواستی در این بخش یافت نشد</div>
                <p className="text-xs text-muted">
                  هنگامی که اعضا درخواست امتیاز ثبت کنند، در این قسمت نمایش داده خواهد شد.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {xpRequests
                  .filter((r) => {
                    if (xpRequestStatusFilter !== 'all' && r.status !== xpRequestStatusFilter) return false
                    if (!xpRequestSearch.trim()) return true
                    const q = xpRequestSearch.toLowerCase()
                    const memberName = r.requester?.full_name?.toLowerCase() || ''
                    const title = r.title?.toLowerCase() || ''
                    const finalName = r.final_task_name?.toLowerCase() || ''
                    return memberName.includes(q) || title.includes(q) || finalName.includes(q)
                  })
                  .map((req) => {
                    const requesterProfile = req.requester || members.find((m) => m.id === req.user_id)
                    const roleBadge = getRoleInfo(requesterProfile?.role)

                    return (
                      <div
                        key={req.id}
                        className={`rounded-2xl border-[1.5px] bg-surface p-4 sm:p-5 transition-all shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] hover:-translate-y-0.5 ${
                          req.status === 'pending'
                            ? 'border-amber-500/50'
                            : req.status === 'approved'
                            ? 'border-emerald-500/40'
                            : 'border-border'
                        }`}
                      >
                        {/* Top: Member Info & Status Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              src={requesterProfile?.avatar_url || null}
                              name={requesterProfile?.full_name || 'عضو'}
                              role={requesterProfile?.role}
                              size="base"
                              shape="circle"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-default">
                                  {requesterProfile?.full_name || 'عضو باشگاه'}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleBadge.colorClass}`}>
                                  {roleBadge.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                                <span>امتیاز فعلی: <strong className="text-amber-500 font-extrabold">{toPersianDigits(requesterProfile?.xp_total || 0)} XP</strong></span>
                                <span>•</span>
                                <span>ارسال: {formatToPersianDate(req.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Tag */}
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {req.status === 'pending' && (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 flex items-center gap-1.5 shadow-2xs">
                                <Clock className="w-3.5 h-3.5" />
                                <span>در انتظار بررسی راهبر</span>
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>تایید شده (+{toPersianDigits(req.awarded_xp || 0)} XP)</span>
                                </span>
                                <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted border border-border">
                                  {req.award_type === 'reward' ? 'تشویقی' : 'تکمیل تسک'}
                                </span>
                              </div>
                            )}
                            {req.status === 'rejected' && (
                              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-500">
                                رد شده
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Request Title & Details */}
                        <div className="py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs text-muted font-medium mb-0.5">عنوان فعالیت ارسالی:</div>
                              <h4 className="text-sm sm:text-base font-bold text-default">
                                {req.title}
                              </h4>
                            </div>
                            {req.suggested_xp && (
                              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 shrink-0">
                                پیشنهاد: {toPersianDigits(req.suggested_xp)} XP
                              </div>
                            )}
                          </div>

                          {req.description && (
                            <div className="rounded-xl bg-surface-2/60 p-3 text-xs text-subtle leading-relaxed whitespace-pre-wrap border border-border/60">
                              {req.description}
                            </div>
                          )}

                          {/* If Approved: Final details */}
                          {req.status === 'approved' && (
                            <div className="mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <span className="font-semibold text-muted ml-1">نام نهایی تسک:</span>
                                  <span className="font-bold text-default">{req.final_task_name || req.title}</span>
                                </div>
                                <div className="text-muted text-[11px]">
                                  بررسی‌شده توسط: <strong className="text-default">{req.reviewer?.full_name || 'راهبر'}</strong> در {req.reviewed_at ? formatToPersianDate(req.reviewed_at) : '-'}
                                </div>
                              </div>
                              {req.target_profiles && req.target_profiles.length > 0 && (
                                <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/10">
                                  <span className="text-muted text-[11px]">اعطای امتیاز به:</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {req.target_profiles.map((tp) => (
                                      <span key={tp.id} className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-default border border-border">
                                        {tp.full_name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {req.reviewer_note && (
                                <div className="text-[11px] text-muted pt-1">
                                  <span>یادداشت راهبر: </span>
                                  <span className="text-default italic">«{req.reviewer_note}»</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* If Rejected: Note */}
                          {req.status === 'rejected' && req.reviewer_note && (
                            <div className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-2.5 text-xs text-rose-500">
                              <span className="font-bold ml-1">دلیل رد درخواست:</span>
                              <span>{req.reviewer_note}</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Action for Pending */}
                        {req.status === 'pending' && (
                          <div className="border-t border-border/70 pt-3 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedRequestForReview(req)}
                              className="rokad-btn-primary px-4 py-2 text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>بررسی، تعیین نوع و اعطای XP</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Detail Modal */}
      {selectedTaskIdForDetail && (
        <TaskDetailModal
          taskId={selectedTaskIdForDetail}
          onClose={() => setSelectedTaskIdForDetail(null)}
          profile={profile}
          onTaskDeleted={async () => {
            setSelectedTaskIdForDetail(null)
            await reload()
          }}
          onTaskUpdated={async () => {
            await reload()
          }}
        />
      )}

      {/* Member Edit Modal */}
      <MemberEditModal
        isOpen={!!memberToEdit}
        member={memberToEdit}
        onClose={() => setMemberToEdit(null)}
        onSuccess={handleMemberUpdated}
      />

      {/* Member XP Management Modal (Reward / Penalty) */}
      <MemberXpModal
        isOpen={!!selectedMemberForXp}
        member={selectedMemberForXp}
        initialType={xpModalTab}
        onClose={() => setSelectedMemberForXp(null)}
        onSuccess={handleXpUpdated}
      />

      {/* Member Profile Modal (Tasks + XP history) */}
      <MemberProfileModal
        userId={profileModalUserId}
        isOpen={!!profileModalUserId}
        onClose={() => setProfileModalUserId(null)}
        currentProfile={profile}
        initialMember={members.find((m) => m.id === profileModalUserId) || null}
        isAdmin={true}
        onXpChanged={handleXpUpdated}
      />

      {/* Review XP Request Modal */}
      <ReviewXpRequestModal
        isOpen={!!selectedRequestForReview}
        request={selectedRequestForReview}
        membersList={members}
        onClose={() => setSelectedRequestForReview(null)}
        onSuccess={handleRequestReviewed}
      />

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setMemberToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-3 mx-auto">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-default text-center mb-2">حذف عضو</h3>
            <p className="text-xs text-muted text-center mb-5 leading-relaxed">
              آیا از حذف <span className="font-semibold text-default">«{memberToDelete.name}»</span> اطمینان دارید؟ تمام اطلاعات، انتساب تسک‌ها و امتیازات این کاربر حذف خواهد شد.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeletingMember}
                onClick={confirmDeleteMember}
                className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {isDeletingMember ? 'در حال حذف...' : 'بله، حذف کن'}
              </button>
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
