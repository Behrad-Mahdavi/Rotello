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
  Users,
  Filter,
  ArrowUpRight,
} from 'lucide-react'
import { toPersianDigits, formatToPersianDate } from '@/utils/jalaali'
import { DEPARTMENTS, type DepartmentKey } from '@/constants/departments'
import type { Profile } from '@/utils/database.types'
import type { MemberAssignmentItem } from './MemberTasksOverviewModal'
import UserAvatar from './UserAvatar'

interface MemberTasksOverviewTabProps {
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

export default function MemberTasksOverviewTab({
  members,
  assignments,
  onOpenProfileModal,
  onOpenTaskDetail,
}: MemberTasksOverviewTabProps) {
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

  // Global KPIs for the header
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. KPIs Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted">کل کارهای محوله</p>
            <p className="text-base sm:text-lg font-black text-default mt-0.5">
              {toPersianDigits(kpis.totalTasks)}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted border border-border">
            <FolderKanban className="w-4.5 h-4.5" />
          </span>
        </div>

        <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">در حال انجام</p>
            <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {toPersianDigits(kpis.inProgressTasks)}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-4.5 h-4.5" />
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">تکمیل‌شده</p>
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {toPersianDigits(kpis.doneTasks)}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </span>
        </div>

        <div className="rounded-2xl border border-[#F8A41D]/25 bg-[#FEF6E8] dark:bg-[#57390A]/30 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#BA7B16] dark:text-[#fde047]">اعضای فعال</p>
            <p className="text-base sm:text-lg font-black text-[#BA7B16] dark:text-[#fde047] mt-0.5">
              {toPersianDigits(kpis.activeMembersCount)} <span className="text-xs font-normal">نفر</span>
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8A41D]/15 text-[#BA7B16] dark:text-[#fde047] border border-[#F8A41D]/30">
            <Users className="w-4.5 h-4.5" />
          </span>
        </div>
      </div>

      {/* 2. Search and Filters Toolbar */}
      <div className="rounded-2xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام عضو، عنوان تسک یا نام پروژه..."
              className="w-full rounded-xl border border-border bg-surface-2/60 py-2.5 pr-9 pl-8 text-xs sm:text-sm font-medium text-default placeholder:text-muted/60 transition-all focus:border-action focus:bg-surface focus:outline-none"
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
            className="rounded-xl border border-border bg-surface-2/80 px-3 py-2 text-xs font-bold text-default focus:border-action focus:outline-none min-h-[40px]"
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
            className="rounded-xl border border-border bg-surface-2/80 px-3 py-2 text-xs font-bold text-default focus:border-action focus:outline-none min-h-[40px]"
          >
            <option value="all">همه دپارتمان‌ها</option>
            <option value="engineers">مهندسی و توسعه</option>
            <option value="artists">طراحی و هنر</option>
            <option value="generalists">جنرالیست</option>
          </select>
        </div>

        {/* Quick Activity Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
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
                : 'bg-surface-2 border border-border text-muted hover:text-default'
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
                : 'bg-surface-2 border border-border text-muted hover:text-default'
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
                : 'bg-surface-2 border border-border text-muted hover:text-default'
            }`}
          >
            بدون تسک ({toPersianDigits(nonAdminMembers.length - kpis.activeMembersCount)})
          </button>
        </div>
      </div>

      {/* 3. Members Task List */}
      <div className="space-y-3.5">
        {filteredMembers.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center space-y-2.5">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-surface-2 text-muted border border-border">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-black text-default">هیچ موردی با این فیلترها یافت نشد</h4>
            <p className="text-xs text-muted max-w-sm mx-auto">
              فیلترهای انتخابی یا عبارت جستجو را تغییر دهید تا وظایف اعضا نمایش داده شوند.
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
                          onClick={() => onOpenProfileModal?.(m.id)}
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

                  {/* Summary Badges & Collapse Toggle */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-bold text-default border border-border/80 text-[11px]"
                        title="کل تسک‌های محوله"
                      >
                        <FolderKanban className="w-3 h-3 text-muted" />
                        <span>{toPersianDigits(allUserTasks.length)} کار</span>
                      </span>

                      {inProgressCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px]"
                          title="تسک‌های در حال انجام"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{toPersianDigits(inProgressCount)} در حال انجام</span>
                        </span>
                      )}

                      <span
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]"
                        title="تسک‌های انجام‌شده"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{toPersianDigits(doneCount)} انجام‌شده ({toPersianDigits(pct)}٪)</span>
                      </span>
                    </div>

                    {allUserTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(m.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2/80 text-muted hover:text-default hover:bg-surface-2 transition-colors border border-border cursor-pointer shrink-0"
                        title={isCollapsed ? 'باز کردن لیست کارها' : 'بستن لیست کارها'}
                      >
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Tasks List */}
                {!isCollapsed && (
                  <div className="p-3.5 sm:p-4 bg-surface-2/30 space-y-2">
                    {displayTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted font-medium bg-surface/60 rounded-xl border border-dashed border-border/80">
                        {allUserTasks.length === 0
                          ? 'هنوز هیچ تسکی به این عضو اختصاص نیافته است.'
                          : 'هیچ تسکی با وضعیت انتخاب‌شده برای این کاربر وجود ندارد.'}
                      </div>
                    ) : (
                      displayTasks.map((task) => {
                        const statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog
                        const priorityConf = task.priority ? PRIORITY_CONFIG[task.priority] : null
                        const StatusIcon = statusConf.icon
                        const overdue = isOverdue(task.deadline, task.status)

                        return (
                          <div
                            key={task.id}
                            onClick={() => onOpenTaskDetail?.(task.id)}
                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface p-3 transition-all hover:border-action/50 hover:bg-surface-2/40 hover:shadow-2xs cursor-pointer"
                          >
                            {/* Title & Project Info */}
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={`mt-0.5 sm:mt-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${statusConf.badgeClass}`}
                                title={statusConf.label}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                              </span>

                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs sm:text-sm font-bold text-default group-hover:text-action transition-colors truncate">
                                  {task.title}
                                </h4>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                                  {task.projects?.name && (
                                    <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.2 font-medium text-muted border border-border/60">
                                      <FolderKanban className="w-3 h-3 text-muted" />
                                      <span className="truncate max-w-[130px] sm:max-w-[200px]">
                                        {task.projects.name}
                                      </span>
                                    </span>
                                  )}

                                  {priorityConf && (
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${priorityConf.badgeClass}`}
                                    >
                                      {priorityConf.label}
                                    </span>
                                  )}

                                  {task.xp_value !== undefined && task.xp_value > 0 && (
                                    <span className="inline-flex items-center gap-0.5 rounded bg-[#FEF6E8] dark:bg-[#57390A]/40 px-1.5 py-0.2 text-[10px] font-black text-[#BA7B16] dark:text-[#fde047] border border-[#F8A41D]/30">
                                      <Zap className="w-2.5 h-2.5" />
                                      <span>{toPersianDigits(task.xp_value)} XP</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status & Deadline */}
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/40">
                              {task.deadline && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-lg px-2 py-0.5 border ${
                                    overdue
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
                                      : 'bg-surface-2 text-muted border-border/70'
                                  }`}
                                  title={overdue ? 'موعد گذشته!' : 'مهلت تحویل'}
                                >
                                  {overdue ? (
                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                  ) : (
                                    <Calendar className="w-3 h-3 text-muted" />
                                  )}
                                  <span>{formatToPersianDate(task.deadline, 'short')}</span>
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border ${statusConf.badgeClass}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dotClass}`} />
                                <span>{statusConf.label}</span>
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
    </div>
  )
}
