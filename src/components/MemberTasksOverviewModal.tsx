'use client'

import { useState, useMemo } from 'react'
import {
  X,
  Search,
  CheckCircle2,
  Clock,
  CircleDot,
  Archive,
  Eye,
  FolderKanban,
  Zap,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Filter,
  ArrowUpRight,
} from 'lucide-react'
import { toPersianDigits, formatToPersianDate } from '@/utils/jalaali'
import { DEPARTMENTS, type DepartmentKey } from '@/constants/departments'
import type { Profile } from '@/utils/database.types'
import UserAvatar from './UserAvatar'

export interface MemberAssignmentItem {
  user_id: string
  tasks: {
    id: string
    title: string
    status: string
    deadline: string | null
    xp_value?: number
    priority?: string
    project_id?: string
    projects?: { name: string } | null
  } | null
}

interface MemberTasksOverviewModalProps {
  isOpen: boolean
  onClose: () => void
  members: Profile[]
  assignments: MemberAssignmentItem[]
  onOpenProfileModal?: (userId: string) => void
  onOpenTaskDetail?: (taskId: string) => void
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; badgeClass: string; dotClass: string }
> = {
  done: {
    label: 'تکمیل‌شده',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
  },
  in_progress: {
    label: 'در حال انجام',
    icon: Clock,
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-500',
  },
  review: {
    label: 'در حال بازبینی',
    icon: Eye,
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotClass: 'bg-purple-500',
  },
  todo: {
    label: 'در صف انجام',
    icon: CircleDot,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  backlog: {
    label: 'بک‌لاگ',
    icon: Archive,
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dotClass: 'bg-slate-400',
  },
}

const PRIORITY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  urgent: {
    label: 'فوری',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
  important: {
    label: 'مهم',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  normal: {
    label: 'عادی',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
}

export default function MemberTasksOverviewModal({
  isOpen,
  onClose,
  members,
  assignments,
  onOpenProfileModal,
  onOpenTaskDetail,
}: MemberTasksOverviewModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activityFilter, setActivityFilter] = useState<'all' | 'with_tasks' | 'no_tasks'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [collapsedMembers, setCollapsedMembers] = useState<Record<string, boolean>>({})

  // Filter out admins since tasks are assigned to members and mentors
  const nonAdminMembers = useMemo(() => {
    return members.filter((m) => m.role !== 'admin')
  }, [members])

  // Map assignments by member id
  const memberTasksMap = useMemo(() => {
    const map: Record<string, NonNullable<MemberAssignmentItem['tasks']>[]> = {}
    for (const m of nonAdminMembers) {
      map[m.id] = []
    }
    for (const a of assignments) {
      if (a.tasks && map[a.user_id]) {
        map[a.user_id].push(a.tasks)
      }
    }
    return map
  }, [nonAdminMembers, assignments])

  // Global KPIs for the modal header
  const kpis = useMemo(() => {
    let totalTasks = 0
    let inProgressTasks = 0
    let doneTasks = 0
    let todoBacklogTasks = 0
    let activeMembersCount = 0

    for (const m of nonAdminMembers) {
      const ts = memberTasksMap[m.id] || []
      if (ts.length > 0) activeMembersCount++
      for (const t of ts) {
        totalTasks++
        if (t.status === 'done') doneTasks++
        else if (t.status === 'in_progress') inProgressTasks++
        else todoBacklogTasks++
      }
    }

    return {
      totalTasks,
      inProgressTasks,
      doneTasks,
      todoBacklogTasks,
      activeMembersCount,
    }
  }, [nonAdminMembers, memberTasksMap])

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return nonAdminMembers.filter((m) => {
      const memberTasks = memberTasksMap[m.id] || []

      // Activity filter
      if (activityFilter === 'with_tasks' && memberTasks.length === 0) return false
      if (activityFilter === 'no_tasks' && memberTasks.length > 0) return false

      // Department filter
      if (departmentFilter !== 'all') {
        const hasDep = (m.departments || []).some((d) => d.department === departmentFilter)
        if (!hasDep) return false
      }

      // Status filter on tasks
      let matchingTasks = memberTasks
      if (statusFilter !== 'all') {
        matchingTasks = memberTasks.filter((t) => t.status === statusFilter)
        // If status filter is set, only show members who have matching tasks
        if (matchingTasks.length === 0) return false
      }

      // Search query (member name, email, or any task title/project name)
      if (q) {
        const matchName = (m.full_name || '').toLowerCase().includes(q)
        const matchEmail = (m.email || '').toLowerCase().includes(q)
        const matchTask = memberTasks.some(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.projects?.name && t.projects.name.toLowerCase().includes(q))
        )
        if (!matchName && !matchEmail && !matchTask) return false
      }

      return true
    })
  }, [nonAdminMembers, memberTasksMap, searchQuery, statusFilter, activityFilter, departmentFilter])

  function toggleCollapse(memberId: string) {
    setCollapsedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }))
  }

  function isOverdue(deadlineStr: string | null, status: string) {
    if (!deadlineStr || status === 'done') return false
    const d = new Date(deadlineStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return d.getTime() < now.getTime()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative max-h-[92vh] sm:max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-t-3xl sm:rounded-3xl border-2 border-border bg-surface shadow-[3.5px_3.5px_0_#202A5A] dark:shadow-[3.5px_3.5px_0_#59BBAF] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-border-strong/60 sm:hidden" />

        {/* 1. Modal Header */}
        <div className="border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-action/10 text-action border border-action/30 shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-default truncate">
                    جزئیات تسک‌ها و وضعیت کارهای اعضا
                  </h2>
                  <span className="hidden xs:inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-muted border border-border">
                    {toPersianDigits(kpis.totalTasks)} کار
                  </span>
                </div>
                <p className="text-xs text-muted truncate mt-0.5">
                  نمایش متمرکز وظایف محوله، وضعیت پیشرفت و سررسید کارها به تفکیک اعضا
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-muted transition-all hover:bg-surface-2 hover:text-default hover:border-action/40 active:scale-95 cursor-pointer shadow-2xs"
              title="بستن پنجره"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* 2. Top KPI Chips Bar */}
          <div className="mt-3.5 grid grid-cols-2 xs:grid-cols-4 gap-2 pt-3 border-t border-border/70">
            <div className="rounded-xl border border-border/80 bg-surface-2/50 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] text-muted font-medium">کل تسک‌ها:</span>
              <span className="text-xs sm:text-sm font-black text-default">
                {toPersianDigits(kpis.totalTasks)}
              </span>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">در حال انجام:</span>
              <span className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">
                {toPersianDigits(kpis.inProgressTasks)}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">تکمیل‌شده:</span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                {toPersianDigits(kpis.doneTasks)}
              </span>
            </div>
            <div className="rounded-xl border border-[#F8A41D]/20 bg-[#FEF6E8] dark:bg-[#57390A]/30 px-3 py-2 flex items-center justify-between">
              <span className="text-[11px] text-[#BA7B16] dark:text-[#fde047] font-medium">اعضای فعال:</span>
              <span className="text-xs sm:text-sm font-black text-[#BA7B16] dark:text-[#fde047]">
                {toPersianDigits(kpis.activeMembersCount)} نفر
              </span>
            </div>
          </div>
        </div>

        {/* 3. Search and Filters Toolbar */}
        <div className="border-b border-border bg-surface-2/40 px-4 py-2.5 sm:px-6 sm:py-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام عضو، عنوان تسک یا نام پروژه..."
                className="w-full rounded-xl border border-border bg-surface py-2 pr-9 pl-8 text-xs font-medium text-default placeholder:text-muted/60 transition-all focus:border-action focus:ring-2 focus:ring-action/20 focus:outline-none min-h-[38px]"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-default cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-default focus:border-action focus:outline-none min-h-[38px]"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="in_progress">در حال انجام</option>
              <option value="done">تکمیل‌شده</option>
              <option value="review">در حال بازبینی</option>
              <option value="todo">صف انجام</option>
              <option value="backlog">بک‌لاگ</option>
            </select>

            {/* Department Filter Dropdown */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-default focus:border-action focus:outline-none min-h-[38px]"
            >
              <option value="all">همه دپارتمان‌ها</option>
              <option value="engineers">مهندسی و توسعه</option>
              <option value="artists">طراحی و هنر</option>
              <option value="generalists">جنرالیست</option>
            </select>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-muted shrink-0 ml-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>فیلتر اعضا:</span>
            </span>
            <button
              type="button"
              onClick={() => setActivityFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold shrink-0 transition-all ${
                activityFilter === 'all'
                  ? 'bg-action text-white shadow-2xs'
                  : 'bg-surface border border-border text-muted hover:text-default'
              }`}
            >
              همه اعضا ({toPersianDigits(nonAdminMembers.length)})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('with_tasks')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold shrink-0 transition-all ${
                activityFilter === 'with_tasks'
                  ? 'bg-action text-white shadow-2xs'
                  : 'bg-surface border border-border text-muted hover:text-default'
              }`}
            >
              دارای تسک ({toPersianDigits(kpis.activeMembersCount)})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('no_tasks')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold shrink-0 transition-all ${
                activityFilter === 'no_tasks'
                  ? 'bg-action text-white shadow-2xs'
                  : 'bg-surface border border-border text-muted hover:text-default'
              }`}
            >
              بدون تسک ({toPersianDigits(nonAdminMembers.length - kpis.activeMembersCount)})
            </button>
          </div>
        </div>

        {/* 4. Members Task List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 overscroll-contain">
          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-surface-2/30 p-10 text-center space-y-2.5 my-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-surface-2 text-muted border border-border">
                <Search className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-default">هیچ عضوی با این مشخصات یافت نشد</h4>
              <p className="text-xs text-muted max-w-sm mx-auto">
                فیلترهای انتخابی یا عبارت جستجو را تغییر دهید تا نتایج نمایش داده شوند.
              </p>
              {(searchQuery || statusFilter !== 'all' || activityFilter !== 'all' || departmentFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                    setActivityFilter('all')
                    setDepartmentFilter('all')
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-action px-3.5 py-1.5 text-xs font-bold text-white hover:bg-action-hover transition-colors shadow-2xs cursor-pointer mt-1"
                >
                  <span>پاکسازی فیلترها</span>
                </button>
              )}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const allUserTasks = memberTasksMap[m.id] || []
              const displayTasks =
                statusFilter === 'all'
                  ? allUserTasks
                  : allUserTasks.filter((t) => t.status === statusFilter)

              const doneCount = allUserTasks.filter((t) => t.status === 'done').length
              const inProgressCount = allUserTasks.filter((t) => t.status === 'in_progress').length
              const pct = allUserTasks.length > 0 ? Math.round((doneCount / allUserTasks.length) * 100) : 0
              const isCollapsed = Boolean(collapsedMembers[m.id])

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border-[1.5px] border-border bg-surface shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF] transition-all overflow-hidden"
                >
                  {/* Member Card Header */}
                  <div className="p-3.5 sm:p-4 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <UserAvatar
                        src={m.avatar_url}
                        name={m.full_name}
                        role={m.role}
                        size="md"
                        shape="rounded"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            onClick={() => {
                              onClose()
                              onOpenProfileModal?.(m.id)
                            }}
                            className="text-xs sm:text-sm font-black text-default hover:text-action transition-colors truncate cursor-pointer flex items-center gap-1 group"
                            title="مشاهده کارنامه عضو"
                          >
                            <span>{m.full_name}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-action" />
                          </h3>
                          {m.role === 'mentor' && (
                            <span className="rounded-full bg-[#652D90]/15 border border-[#652D90]/30 px-2 py-0.2 text-[10px] font-black text-[#652D90] dark:text-[#c084fc]">
                              منتور
                            </span>
                          )}
                        </div>

                        {/* Department badges */}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {m.departments && m.departments.length > 0 ? (
                            m.departments.map((d) => (
                              <span
                                key={d.department}
                                className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                                  DEPARTMENTS[d.department as DepartmentKey]?.badgeClass ||
                                  'bg-surface-2 text-muted border border-border'
                                }`}
                              >
                                {DEPARTMENTS[d.department as DepartmentKey]?.label || d.department} (سطح {d.level})
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted font-medium">بدون دپارتمان ثبت‌شده</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member Stats & Toggle */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      {/* XP Badge */}
                      <span className="inline-flex items-center gap-1 rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 border border-[#F8A41D]/40 px-2.5 py-1 text-xs font-black text-[#BA7B16] dark:text-[#fde047] shadow-2xs">
                        <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                        <span>{toPersianDigits(m.xp_total || 0)} XP</span>
                      </span>

                      {/* Tasks count & progress */}
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-surface-2 border border-border px-2.5 py-0.5 text-[11px] font-bold text-muted">
                          {allUserTasks.length > 0
                            ? `${toPersianDigits(allUserTasks.length)} تسک (${toPersianDigits(pct)}٪ تکمیل)`
                            : 'بدون تسک'}
                        </span>

                        {allUserTasks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(m.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 border border-border text-muted hover:text-default hover:border-action/40 transition-colors cursor-pointer"
                            title={isCollapsed ? 'نمایش تسک‌ها' : 'بستن تسک‌ها'}
                          >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tasks List inside Member Card */}
                  {!isCollapsed && (
                    <div className="p-3 sm:p-4 bg-surface-2/30 space-y-2">
                      {displayTasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-surface/60 py-4 px-3 text-center text-xs text-muted font-medium">
                          {statusFilter === 'all'
                            ? 'هیچ تسک فعالی به این عضو محول نشده است.'
                            : 'هیچ تسکی با این وضعیت برای این عضو یافت نشد.'}
                        </div>
                      ) : (
                        displayTasks.map((t) => {
                          const statusConf = STATUS_CONFIG[t.status] || STATUS_CONFIG.backlog
                          const priorityConf = PRIORITY_CONFIG[t.priority || 'normal'] || PRIORITY_CONFIG.normal
                          const StatusIcon = statusConf.icon
                          const overdue = isOverdue(t.deadline, t.status)
                          const projectName =
                            t.projects && typeof t.projects === 'object' && 'name' in t.projects
                              ? (t.projects as { name: string }).name
                              : null

                          return (
                            <div
                              key={t.id}
                              onClick={() => onOpenTaskDetail?.(t.id)}
                              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3 transition-all hover:border-action/50 hover:bg-surface hover:shadow-xs cursor-pointer active:scale-[0.995]"
                              title="کلیک برای مشاهده و ویرایش جزئیات تسک"
                            >
                              {/* Title & Project & Status */}
                              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border mt-0.5 sm:mt-0 ${statusConf.badgeClass}`}>
                                  <StatusIcon className="h-3.5 w-3.5" />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="text-xs sm:text-sm font-bold text-default group-hover:text-action transition-colors line-clamp-1">
                                      {t.title}
                                    </h4>
                                    {projectName && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 border border-border px-1.5 py-0.2 text-[10px] font-bold text-muted shrink-0">
                                        <FolderKanban className="w-2.5 h-2.5 text-action" />
                                        <span>{projectName}</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted">
                                    <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold ${statusConf.badgeClass}`}>
                                      {statusConf.label}
                                    </span>
                                    <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold ${priorityConf.badgeClass}`}>
                                      {priorityConf.label}
                                    </span>
                                    {t.deadline ? (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                          overdue
                                            ? 'text-rose-500 font-extrabold'
                                            : 'text-muted'
                                        }`}
                                      >
                                        <Calendar className="w-3 h-3" />
                                        <span>{formatToPersianDate(t.deadline)}</span>
                                        {overdue && (
                                          <span className="rounded bg-rose-500/10 text-rose-500 px-1 py-0.2 text-[9px] border border-rose-500/20">
                                            گذشته
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted/60">بدون ددلاین</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Task XP & Action */}
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                {(t.xp_value || 0) > 0 && (
                                  <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400 shadow-2xs">
                                    +{toPersianDigits(t.xp_value || 0)} XP
                                  </span>
                                )}
                                <span className="text-[11px] font-bold text-action opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                  <span>مشاهده</span>
                                  <ArrowUpRight className="h-3 w-3" />
                                </span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 5. Modal Footer */}
        <div className="border-t border-border bg-surface px-4 py-3 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-muted font-medium">
            نمایش {toPersianDigits(filteredMembers.length)} از {toPersianDigits(nonAdminMembers.length)} عضو
          </span>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-surface-2/80 px-4 py-2 text-xs font-bold text-default hover:bg-surface hover:border-action/40 transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  )
}
