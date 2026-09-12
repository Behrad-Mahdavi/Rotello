'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { DEPARTMENTS } from '@/constants/departments'
import type { Profile } from '@/utils/database.types'
import UserAvatar from '@/components/UserAvatar'
import {
  Users,
  UserPlus,
  UserMinus,
  X,
  Search,
  Check,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface ProjectMembersModalProps {
  isOpen: boolean
  projectId: string
  projectName: string
  onClose: () => void
  canManage?: boolean
  onMembersUpdated?: (members: Profile[]) => void
}

export default function ProjectMembersModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  canManage = true,
  onMembersUpdated,
}: ProjectMembersModalProps) {
  useBodyScrollLock(isOpen)

  const [members, setMembers] = useState<Profile[]>([])
  const [allSystemMembers, setAllSystemMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load project members and all system members
  useEffect(() => {
    if (!isOpen || !projectId) return

    let isMounted = true
    setLoading(true)
    setError('')

    async function loadData() {
      try {
        const [projRes, sysRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/members`),
          canManage ? fetch('/api/members') : Promise.resolve(null),
        ])

        if (!isMounted) return

        if (projRes.ok) {
          const projData = await projRes.json()
          setMembers(projData.members || [])
          onMembersUpdated?.(projData.members || [])
        } else {
          setError('خطا در دریافت لیست اعضای پروژه')
        }

        if (sysRes && sysRes.ok) {
          const sysData = await sysRes.json()
          setAllSystemMembers(sysData.members || [])
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'خطای شبکه'
          setError(msg)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [isOpen, projectId, canManage])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Available users to add (system members not yet in this project)
  const availableUsers = useMemo(() => {
    const currentMemberIds = new Set(members.map((m) => m.id))
    return allSystemMembers.filter((u) => !currentMemberIds.has(u.id))
  }, [allSystemMembers, members])

  const filteredAvailableUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers
    const q = searchQuery.toLowerCase()
    return availableUsers.filter((u) => u.full_name?.toLowerCase().includes(q))
  }, [availableUsers, searchQuery])

  const selectedUser = useMemo(() => {
    return allSystemMembers.find((u) => u.id === selectedUserId)
  }, [allSystemMembers, selectedUserId])

  // Add member
  async function handleAddMember() {
    if (!selectedUserId || adding) return
    setAdding(true)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'خطا در افزودن عضو')
      }

      const data = await res.json()
      setMembers(data.members || [])
      onMembersUpdated?.(data.members || [])
      setSelectedUserId('')
      setSearchQuery('')
      setDropdownOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت عضو'
      setError(msg)
    } finally {
      setAdding(false)
    }
  }

  // Remove member
  async function handleRemoveMember(userId: string) {
    if (removingId) return
    setRemovingId(userId)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'خطا در حذف عضو')
      }

      const data = await res.json()
      setMembers(data.members || [])
      onMembersUpdated?.(data.members || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف عضو'
      setError(msg)
    } finally {
      setRemovingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border bg-surface shadow-2xl transition-all max-h-[90vh] sm:max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border-strong/60 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-surface px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-action/10 text-action shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-default truncate">
                اعضای پروژه: {projectName}
              </h2>
              <p className="text-[11px] text-muted truncate">
                {members.length} عضو ثبت‌شده در این پروژه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-default cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-xs text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add member section (for admins/mentors) */}
          {canManage && (
            <div className="rounded-xl border border-border/80 bg-surface-2/40 p-3 sm:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-default flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4 text-action" />
                  <span>افزودن عضو جدید به این پروژه</span>
                </label>
                <span className="text-[11px] text-muted">
                  {availableUsers.length} کاربر دیگر موجود
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Searchable Dropdown */}
                <div className="relative flex-1" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs text-default hover:border-action/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedUser ? (
                        <>
                          <UserAvatar
                            src={selectedUser.avatar_url}
                            name={selectedUser.full_name}
                            size="xs"
                            shape="circle"
                          />
                          <span className="truncate font-semibold">{selectedUser.full_name}</span>
                        </>
                      ) : (
                        <span className="text-muted">انتخاب کاربر برای افزودن...</span>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute top-full right-0 left-0 mt-1 z-30 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface shadow-xl py-1">
                      <div className="p-2 border-b border-border/60 sticky top-0 bg-surface">
                        <div className="relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="جستجوی نام کاربر..."
                            className="w-full rounded-lg border border-border/80 bg-surface-2/50 py-1.5 pr-7 pl-2 text-xs text-default focus:border-action focus:outline-none"
                            autoFocus
                          />
                          <Search className="absolute right-2 top-2 h-3.5 w-3.5 text-muted" />
                        </div>
                      </div>

                      {filteredAvailableUsers.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted">
                          کاربر دیگری برای افزودن یافت نشد.
                        </div>
                      ) : (
                        filteredAvailableUsers.map((u) => {
                          const isSelected = u.id === selectedUserId
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUserId(u.id)
                                setDropdownOpen(false)
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-surface-2 text-right ${
                                isSelected ? 'bg-action/10 text-action font-bold' : 'text-default'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                  <UserAvatar
                                    src={u.avatar_url}
                                    name={u.full_name}
                                    size="sm"
                                    shape="circle"
                                  />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{u.full_name}</div>
                                  {u.departments && u.departments.length > 0 && (
                                    <div className="text-[10px] text-muted truncate">
                                      {u.departments.map((d) => DEPARTMENTS[d.department]?.label || d.department).join('، ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-action shrink-0" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!selectedUserId || adding}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-action px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>افزودن عضو</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-default flex items-center justify-between">
              <span>لیست اعضای اختصاص‌یافته به پروژه</span>
              <span className="text-[11px] text-muted">
                {members.length} نفر
              </span>
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-action" />
                <span>در حال دریافت اعضای پروژه...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
                هنوز هیچ عضوی به این پروژه اختصاص داده نشده است.
                {canManage && (
                  <div className="mt-1 text-[11px] text-amber-500 font-semibold">
                    برای اینکه امکان تعریف تسک فراهم شود، لطفاً حداقل یک عضو اضافه کنید.
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50 rounded-xl border border-border/70 bg-surface overflow-hidden">
                {members.map((m) => {
                  const isRemoving = removingId === m.id
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-2.5 sm:p-3 transition-colors hover:bg-surface-2/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={m.avatar_url}
                          name={m.full_name}
                          role={m.role}
                          size="md"
                          shape="rounded"
                        />

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-default truncate">
                            {m.full_name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {m.departments && m.departments.length > 0 ? (
                              m.departments.map((d) => (
                                <span
                                  key={d.department}
                                  className={`rounded px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold ${
                                    DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-muted'
                                  }`}
                                >
                                  {DEPARTMENTS[d.department]?.label} (سطح {d.level})
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted">عضو باشگاه</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={isRemoving}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                          title="حذف از پروژه"
                        >
                          {isRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/80 bg-surface-2/30 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface border border-border px-4 py-2 text-xs font-semibold text-default hover:bg-surface-2 transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  )
}
