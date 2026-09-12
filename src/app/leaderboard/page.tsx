'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import MemberProfileModal from '@/components/MemberProfileModal'
import { DEPARTMENTS, type DepartmentKey, type DepartmentLevel } from '@/constants/departments'
import type { Profile } from '@/utils/database.types'
import {
  Trophy,
  Crown,
  Medal,
  Zap,
  Search,
  BarChart3,
  X,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react'

export default function LeaderboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      const [profRes, membersFetch] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        // Rule: Leaderboard is strictly for 'member' role (no mentors or admins)
        fetch('/api/members?role=member').then((r) => (r.ok ? r.json() : { members: [] })),
      ])

      const userRole = (user.user_metadata?.role || profRes.data?.role || 'member')
      const userDeps = profRes.data?.departments || (user.user_metadata?.departments || [])

      if (profRes.data) {
        setProfile({
          ...profRes.data,
          role: userRole,
          departments: userDeps,
          avatar_url: profRes.data.avatar_url || user.user_metadata?.avatar_url || null,
        })
      }
      if (membersFetch?.members) {
        // Strictly filter out any non-member just in case
        const regularMembers = (membersFetch.members as Profile[]).filter((m) => m.role === 'member')
        setMembers(regularMembers)
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  // Overall Global Statistics (All members)
  const overallStats = useMemo(() => {
    const totalXp = members.reduce((sum, m) => sum + (m.xp_total || 0), 0)
    const avgXp = members.length > 0 ? Math.round(totalXp / members.length) : 0
    const topLeader = members[0] || null
    return { totalXp, avgXp, topLeader }
  }, [members])

  // Current logged in user's rank in the overall leaderboard
  const currentUserRankInfo = useMemo(() => {
    if (!profile || profile.role !== 'member') return null
    const idx = members.findIndex((m) => m.id === profile.id)
    if (idx === -1) return null

    const rank = idx + 1
    const nextMember = idx > 0 ? members[idx - 1] : null
    const gapToNext = nextMember ? (nextMember.xp_total - profile.xp_total) : 0

    return {
      rank,
      gapToNext,
      isTop: rank === 1,
    }
  }, [members, profile])

  // Filtered members by Search Query only
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase().trim()
    return members.filter((m) => (m.full_name || '').toLowerCase().includes(q))
  }, [members, searchQuery])

  // Top 3 from the currently filtered members
  const top1 = filteredMembers[0] || null
  const top2 = filteredMembers[1] || null
  const top3 = filteredMembers[2] || null
  const maxScore = top1?.xp_total || 1

  // Podium is active when there is no active search and at least 2 members are present
  const isPodiumActive = !searchQuery.trim() && filteredMembers.length >= 2
  const listMembers = isPodiumActive ? filteredMembers.slice(3) : filteredMembers

  return (
    <div className="flex min-h-screen flex-col bg-canvas transition-colors duration-200" dir="rtl">
      <AppHeader profile={profile} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {/* 1. Header & Summary Stats */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FEF6E8] dark:bg-[#57390A]/40 text-[#BA7B16] dark:text-[#fde047] border-[1.5px] border-[#F8A41D]/40 shadow-[2px_2px_0_#F8A41D]">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-default tracking-tight">
                  لیدربورد اعضای باشگاه کسب‌وکار رکاد
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Stats Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-border bg-surface px-3 py-1.5 shadow-2xs">
              <span className="text-xs text-muted font-semibold">اعضای فعال:</span>
              <span className="text-xs sm:text-sm font-black text-default">{members.length.toLocaleString('fa-IR')} نفر</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-[#F8A41D]/40 bg-surface px-3 py-1.5 shadow-2xs">
              <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
              <span className="text-xs text-muted font-semibold">مجموع امتیازات:</span>
              <span className="text-xs sm:text-sm font-black text-[#F8A41D]">
                {overallStats.totalXp.toLocaleString('fa-IR')} XP
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-border bg-surface px-3 py-1.5 shadow-2xs">
              <span className="text-xs text-muted font-semibold">میانگین:</span>
              <span className="text-xs sm:text-sm font-black text-default">
                {overallStats.avgXp.toLocaleString('fa-IR')} XP
              </span>
            </div>
          </div>
        </div>

        {/* 2. Spotlight Banner for Current User */}
        {profile && currentUserRankInfo && (
          <div className="relative overflow-hidden rounded-2xl border-[1.5px] border-[#59BBAF]/60 bg-surface p-4 sm:p-5 shadow-[2.5px_2.5px_0_#59BBAF] transition-all">
            <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-[#59BBAF]/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#59BBAF] to-[#202A5A] text-white text-lg font-black shadow-sm ring-4 ring-[#59BBAF]/20">
                  {profile.full_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-action/20 text-action px-2.5 py-0.5 text-xs font-black">
                      رتبه #{currentUserRankInfo.rank.toLocaleString('fa-IR')} در کل باشگاه
                    </span>
                    {currentUserRankInfo.isTop ? (
                      <span className="text-xs font-black text-[#F8A41D] flex items-center gap-1">
                        <Crown className="h-3.5 w-3.5" />
                        <span>صدرنشین لیدربورد!</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted font-semibold">
                        تنها <strong className="text-[#F8A41D] font-black">{currentUserRankInfo.gapToNext.toLocaleString('fa-IR')} XP</strong> تا رتبه بعدی
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-default mt-0.5">
                    {profile.full_name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="rounded-xl border-[1.5px] border-border bg-surface-2 px-3.5 py-1.5 text-center">
                  <div className="text-[11px] text-muted font-bold">امتیاز فعال شما</div>
                  <div className="text-sm sm:text-base font-black text-[#F8A41D]">
                    {profile.xp_total.toLocaleString('fa-IR')} XP
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMemberId(profile.id)}
                  className="rokad-btn-primary px-3.5 py-2 text-xs sm:text-sm font-bold"
                >
                  کارنامه من ←
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Search Bar */}
        <div className="rounded-2xl border-[1.5px] border-border bg-surface p-3 sm:p-4 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF]">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام عضو در لیدربورد..."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2 pr-9 pl-8 text-xs sm:text-sm font-medium text-default placeholder:text-muted/60 transition-all focus:border-action focus:bg-surface focus:outline-none"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-default hover:bg-surface-2 transition-colors cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Active Search Note */}
          {searchQuery.trim() && (
            <div className="pt-2.5 mt-2.5 border-t border-border/70 flex items-center justify-between text-xs text-muted font-medium">
              <span>
                نمایش <strong>{filteredMembers.length}</strong> نتیجه برای عبارت «{searchQuery}»
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-action font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>پاک کردن جستجو</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 4. Content Area */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
              <div className="h-48 rounded-2xl bg-surface-2/70 border border-border" />
              <div className="h-52 rounded-2xl bg-surface-2/70 border border-border" />
              <div className="h-48 rounded-2xl bg-surface-2/70 border border-border" />
            </div>
            <div className="h-48 rounded-2xl bg-surface-2/70 border border-border" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-2xl border-[1.5px] border-border bg-surface p-10 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted border border-border">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-black text-default text-sm sm:text-base">عضوی با این نام یافت نشد</h3>
            <p className="text-xs text-muted mt-1 font-medium">عبارت جستجو را تغییر دهید یا پاک کنید.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 5. Olympic Podium for Top 3 (Snug, compact, WITHOUT any heading text) */}
            {isPodiumActive && top1 && (
              <div className="space-y-3">
                {/* Desktop Podium */}
                <div className="hidden sm:grid sm:grid-cols-3 sm:items-end gap-4 pt-1">
                  {/* Rank 2 - Silver (Right in RTL) */}
                  {top2 ? (
                    <div
                      onClick={() => setSelectedMemberId(top2.id)}
                      className="group cursor-pointer select-none relative flex flex-col items-center rounded-2xl border-[1.5px] border-slate-300 dark:border-slate-600 bg-surface p-4 text-center shadow-[2.5px_2.5px_0_#94a3b8] transition-all duration-200 hover:-translate-y-1 hover:shadow-[3.5px_3.5px_0_#94a3b8] active:scale-[0.98]"
                      title="مشاهده کارنامه و عملکرد"
                    >
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-400 px-3 py-0.5 text-xs font-black text-slate-800 dark:text-slate-200 shadow-sm flex items-center gap-1">
                        <Medal className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
                        <span>رتبه ۲</span>
                      </div>

                      <div className="pt-2 flex flex-col items-center w-full">
                        <div className="relative mb-2 flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 text-white text-lg font-black shadow-sm ring-4 ring-slate-300/30 group-hover:scale-105 transition-transform overflow-hidden">
                          {top2.avatar_url ? (
                            <img src={top2.avatar_url} alt={top2.full_name} className="h-full w-full object-cover" />
                          ) : (
                            top2.full_name.charAt(0)
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-default group-hover:text-action transition-colors line-clamp-1">
                          {top2.full_name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                          {top2.departments && top2.departments.length > 0 ? (
                            top2.departments.map((d) => (
                              <span
                                key={d.department}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                                  DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-default border border-border'
                                }`}
                              >
                                <span>{DEPARTMENTS[d.department]?.label || d.department}</span>
                                <span className="opacity-80 font-medium">| سطح تخصصی {d.level}</span>
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                              <span>عضو باشگاه</span>
                              <span className="opacity-70">| سطح عمومی</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full mt-3 pt-2.5 border-t border-border/70 flex items-center justify-between px-1">
                        <div className="flex items-center gap-1 text-sm sm:text-base font-black text-[#F8A41D]">
                          <Zap className="h-4 w-4 text-[#F8A41D]" />
                          <span>{top2.xp_total.toLocaleString('fa-IR')} XP</span>
                        </div>
                        <span className="text-xs font-bold text-action opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <span>کارنامه</span>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Rank 1 - Gold (Center, Elevated & Prominent) */}
                  <div
                    onClick={() => setSelectedMemberId(top1.id)}
                    className="group cursor-pointer select-none relative flex flex-col items-center rounded-2xl border-2 border-[#F8A41D] bg-surface p-4 sm:p-5 text-center shadow-[3.5px_3.5px_0_#BA7B16] dark:shadow-[3.5px_3.5px_0_#F8A41D] transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[4.5px_4.5px_0_#BA7B16] active:scale-[0.98] z-10"
                    title="پیشتاز لیدربورد - کلیک برای مشاهده کارنامه"
                  >
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-[#F8A41D] px-3.5 py-0.5 text-xs font-black text-white shadow-md flex items-center gap-1.5 animate-bounce">
                      <Crown className="h-3.5 w-3.5" />
                      <span>پیشتاز لیدربورد</span>
                    </div>

                    <div className="pt-2 flex flex-col items-center w-full">
                      <div className="relative mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-[#F8A41D] to-yellow-600 text-white text-xl font-black shadow-md ring-4 ring-[#F8A41D]/30 group-hover:scale-105 transition-transform overflow-hidden">
                        {top1.avatar_url ? (
                          <img src={top1.avatar_url} alt={top1.full_name} className="h-full w-full object-cover" />
                        ) : (
                          top1.full_name.charAt(0)
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-default group-hover:text-action transition-colors line-clamp-1">
                        {top1.full_name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                        {top1.departments && top1.departments.length > 0 ? (
                          top1.departments.map((d) => (
                            <span
                              key={d.department}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                                DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-default border border-border'
                              }`}
                            >
                              <span>{DEPARTMENTS[d.department]?.label || d.department}</span>
                              <span className="opacity-80 font-medium">| سطح تخصصی {d.level}</span>
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                            <span>عضو باشگاه</span>
                            <span className="opacity-70">| سطح عمومی</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full mt-3.5 pt-2.5 border-t border-[#F8A41D]/30 flex items-center justify-between px-1">
                      <div className="flex items-center gap-1 text-base sm:text-lg font-black text-[#F8A41D]">
                        <Zap className="h-4 w-4 text-[#F8A41D]" />
                        <span>{top1.xp_total.toLocaleString('fa-IR')} XP</span>
                      </div>
                      <span className="text-xs font-black text-action opacity-90 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <span>مشاهده کارنامه</span>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Rank 3 - Bronze (Left in RTL) */}
                  {top3 ? (
                    <div
                      onClick={() => setSelectedMemberId(top3.id)}
                      className="group cursor-pointer select-none relative flex flex-col items-center rounded-2xl border-[1.5px] border-amber-800/40 dark:border-amber-700/50 bg-surface p-4 text-center shadow-[2.5px_2.5px_0_#92400e] transition-all duration-200 hover:-translate-y-1 hover:shadow-[3.5px_3.5px_0_#92400e] active:scale-[0.98]"
                      title="مشاهده کارنامه و عملکرد"
                    >
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FEF6E8] dark:bg-[#57390A]/60 text-amber-800 dark:text-amber-300 border border-amber-700/40 px-3 py-0.5 text-xs font-black shadow-sm flex items-center gap-1">
                        <Medal className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
                        <span>رتبه ۳</span>
                      </div>

                      <div className="pt-2 flex flex-col items-center w-full">
                        <div className="relative mb-2 flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white text-lg font-black shadow-sm ring-4 ring-amber-700/30 group-hover:scale-105 transition-transform overflow-hidden">
                          {top3.avatar_url ? (
                            <img src={top3.avatar_url} alt={top3.full_name} className="h-full w-full object-cover" />
                          ) : (
                            top3.full_name.charAt(0)
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-default group-hover:text-action transition-colors line-clamp-1">
                          {top3.full_name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                          {top3.departments && top3.departments.length > 0 ? (
                            top3.departments.map((d) => (
                              <span
                                key={d.department}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                                  DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-default border border-border'
                                }`}
                              >
                                <span>{DEPARTMENTS[d.department]?.label || d.department}</span>
                                <span className="opacity-80 font-medium">| سطح تخصصی {d.level}</span>
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                              <span>عضو باشگاه</span>
                              <span className="opacity-70">| سطح عمومی</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full mt-3 pt-2.5 border-t border-border/70 flex items-center justify-between px-1">
                        <div className="flex items-center gap-1 text-sm sm:text-base font-black text-[#F8A41D]">
                          <Zap className="h-4 w-4 text-[#F8A41D]" />
                          <span>{top3.xp_total.toLocaleString('fa-IR')} XP</span>
                        </div>
                        <span className="text-xs font-bold text-action opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <span>کارنامه</span>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                {/* Mobile Olympic-Style Podium */}
                <div className="sm:hidden pt-6 pb-2">
                  <div className="grid grid-cols-3 items-end gap-2 px-1">
                    {/* Rank 2 (Silver) - Right column in RTL */}
                    {top2 ? (
                      <div
                        onClick={() => setSelectedMemberId(top2.id)}
                        className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 text-white font-black text-sm shadow-md ring-3 ring-slate-300 dark:ring-slate-600 overflow-hidden">
                            {top2.avatar_url ? (
                              <img src={top2.avatar_url} alt={top2.full_name} className="h-full w-full object-cover" />
                            ) : (
                              top2.full_name.charAt(0)
                            )}
                          </div>
                          <span className="absolute -bottom-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-2 py-0.2 text-[10px] font-black shadow-xs">
                            ۲
                          </span>
                        </div>

                        <span className="text-xs font-black text-default text-center truncate max-w-full mt-1.5">
                          {top2.full_name.split(' ')[0]}
                        </span>
                        <div className="flex items-center gap-0.5 text-[11px] font-extrabold text-[#F8A41D] mt-0.5">
                          <Zap className="h-3 w-3 text-[#F8A41D] shrink-0" />
                          <span>{top2.xp_total.toLocaleString('fa-IR')}</span>
                        </div>

                        {/* Podium Step 2 */}
                        <div className="w-full mt-2 h-18 rounded-t-xl bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-t-2 border-x-2 border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-base font-black text-slate-500 dark:text-slate-400">2</span>
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">نقره</span>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Rank 1 (Gold) - Center column */}
                    {top1 ? (
                      <div
                        onClick={() => setSelectedMemberId(top1.id)}
                        className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform -mt-4 z-10"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <Crown className="h-5 w-5 text-amber-500 animate-bounce mb-0.5" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-base shadow-lg ring-4 ring-[#F8A41D]/50 overflow-hidden">
                            {top1.avatar_url ? (
                              <img src={top1.avatar_url} alt={top1.full_name} className="h-full w-full object-cover" />
                            ) : (
                              top1.full_name.charAt(0)
                            )}
                          </div>
                          <span className="absolute -bottom-2 rounded-full bg-amber-500 text-white border-2 border-surface px-2 py-0.2 text-[10px] font-black shadow-xs">
                            ۱
                          </span>
                        </div>

                        <span className="text-xs font-black text-default text-center truncate max-w-full mt-1.5">
                          {top1.full_name.split(' ')[0]}
                        </span>
                        <div className="flex items-center gap-0.5 text-xs font-black text-[#F8A41D] mt-0.5">
                          <Zap className="h-3.5 w-3.5 text-[#F8A41D] shrink-0" />
                          <span>{top1.xp_total.toLocaleString('fa-IR')}</span>
                        </div>

                        {/* Podium Step 1 */}
                        <div className="w-full mt-2 h-24 rounded-t-xl bg-gradient-to-t from-amber-500/20 to-amber-500/10 dark:from-amber-500/30 dark:to-amber-500/20 border-t-2 border-x-2 border-[#F8A41D] flex flex-col items-center justify-center shadow-xs">
                          <span className="text-xl font-black text-[#F8A41D]">1</span>
                          <span className="text-[10px] font-black text-[#F8A41D]">طلا</span>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Rank 3 (Bronze) - Left column in RTL */}
                    {top3 ? (
                      <div
                        onClick={() => setSelectedMemberId(top3.id)}
                        className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
                      >
                        <div className="relative mb-2 flex flex-col items-center">
                          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-sm shadow-md ring-3 ring-amber-700/30 overflow-hidden">
                            {top3.avatar_url ? (
                              <img src={top3.avatar_url} alt={top3.full_name} className="h-full w-full object-cover" />
                            ) : (
                              top3.full_name.charAt(0)
                            )}
                          </div>
                          <span className="absolute -bottom-2 rounded-full bg-[#FEF6E8] dark:bg-[#57390A] text-amber-800 dark:text-amber-300 border border-amber-700/40 px-2 py-0.2 text-[10px] font-black shadow-xs">
                            ۳
                          </span>
                        </div>

                        <span className="text-xs font-black text-default text-center truncate max-w-full mt-1.5">
                          {top3.full_name.split(' ')[0]}
                        </span>
                        <div className="flex items-center gap-0.5 text-[11px] font-extrabold text-[#F8A41D] mt-0.5">
                          <Zap className="h-3 w-3 text-[#F8A41D] shrink-0" />
                          <span>{top3.xp_total.toLocaleString('fa-IR')}</span>
                        </div>

                        {/* Podium Step 3 */}
                        <div className="w-full mt-2 h-14 rounded-t-xl bg-gradient-to-t from-amber-900/15 to-amber-800/10 dark:from-amber-950 dark:to-amber-900/30 border-t-2 border-x-2 border-amber-700/40 flex flex-col items-center justify-center shadow-xs">
                          <span className="text-sm font-black text-amber-800 dark:text-amber-400">3</span>
                          <span className="text-[9px] font-bold text-amber-800 dark:text-amber-400">برنز</span>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 6. Members Ranked Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 text-[#BA7B16] dark:text-[#fde047] border border-[#F8A41D]/30 shadow-2xs">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-default">
                      {searchQuery.trim() ? 'نتایج جستجوی اعضا' : isPodiumActive ? 'سایر رتبه‌ها' : 'جدول رده‌بندی اعضای باشگاه'}
                    </h2>
                  </div>
                </div>
                <span className="rounded-full bg-surface-2 border border-border px-3 py-1 text-xs font-bold text-muted">
                  {listMembers.length.toLocaleString('fa-IR')} عضو
                </span>
              </div>

              {/* Redesigned Members Table */}
              <div className="rounded-2xl border-[1.5px] border-border bg-surface shadow-[2.5px_2.5px_0_#202A5A] dark:shadow-[2.5px_2.5px_0_#59BBAF] overflow-hidden transition-colors">
                {/* Desktop Column Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-3 items-center px-5 py-3 border-b border-border bg-surface-2/60 text-xs font-black text-muted">
                  <div className="col-span-1 text-center">رتبه</div>
                  <div className="col-span-4">عضو باشگاه</div>
                  <div className="col-span-3">دپارتمان و سطح تخصصی</div>
                  <div className="col-span-2 text-center">نسبت به صدر</div>
                  <div className="col-span-2 text-left pl-2">امتیاز (XP)</div>
                </div>

                {/* Rows List */}
                <div className="divide-y divide-border/70">
                  {listMembers.map((m) => {
                    const actualRank = members.findIndex((x) => x.id === m.id) + 1
                    const scorePct = maxScore > 0 ? Math.round((m.xp_total / maxScore) * 100) : 0
                    const isCurrentUser = profile?.id === m.id

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`group cursor-pointer select-none px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-150 hover:bg-surface-2 active:scale-[0.995] ${
                          isCurrentUser ? 'bg-action/5 ring-1 ring-inset ring-action/30' : ''
                        }`}
                        title="کلیک برای مشاهده کارنامه و عملکرد"
                      >
                        {/* Desktop Row Grid */}
                        <div className="hidden md:grid md:grid-cols-12 gap-3 items-center">
                          {/* Rank */}
                          <div className="col-span-1 flex justify-center">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black shadow-xs transition-transform group-hover:scale-105 ${
                                actualRank === 1
                                  ? 'bg-gradient-to-br from-amber-400 to-[#F8A41D] text-white ring-2 ring-[#F8A41D]/30'
                                  : actualRank === 2
                                  ? 'bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-600 dark:to-slate-500 text-slate-900 dark:text-white ring-2 ring-slate-400/30'
                                  : actualRank === 3
                                  ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-2 ring-amber-700/30'
                                  : 'bg-surface-2 border border-border text-muted group-hover:text-default group-hover:border-action/40'
                              }`}
                            >
                              {actualRank === 1 ? (
                                <span className="flex items-center gap-0.5"><Crown className="h-3 w-3" />۱</span>
                              ) : actualRank === 2 ? (
                                <span className="flex items-center gap-0.5"><Medal className="h-3 w-3" />۲</span>
                              ) : actualRank === 3 ? (
                                <span className="flex items-center gap-0.5"><Medal className="h-3 w-3" />۳</span>
                              ) : (
                                `#${actualRank.toLocaleString('fa-IR')}`
                              )}
                            </div>
                          </div>

                          {/* Member info */}
                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-xs transition-transform duration-200 group-hover:scale-105 overflow-hidden ${
                                actualRank === 1
                                  ? 'bg-gradient-to-br from-amber-400 via-[#F8A41D] to-yellow-600 ring-2 ring-[#F8A41D]/50'
                                  : actualRank === 2
                                  ? 'bg-gradient-to-br from-slate-300 to-slate-500 ring-2 ring-slate-400/40'
                                  : actualRank === 3
                                  ? 'bg-gradient-to-br from-amber-600 to-amber-800 ring-2 ring-amber-700/40'
                                  : 'bg-gradient-to-br from-[#59BBAF] to-[#202A5A]'
                              }`}
                            >
                              {m.avatar_url ? (
                                <img src={m.avatar_url} alt={m.full_name} className="h-full w-full object-cover" />
                              ) : (
                                m.full_name.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="truncate text-sm font-black text-default group-hover:text-action transition-colors">
                                  {m.full_name}
                                </h3>
                                {isCurrentUser && (
                                  <span className="rounded-full bg-action/20 text-action text-[10px] font-black px-2 py-0.5 shrink-0">
                                    شما
                                  </span>
                                )}
                              </div>
                              {actualRank <= 3 && (
                                <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400">
                                  {actualRank === 1 ? 'پیشتاز مسابقات' : actualRank === 2 ? 'نایب قهرمان' : 'رتبه سوم لیدربورد'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Departments */}
                          <div className="col-span-3 flex flex-wrap items-center gap-1">
                            {m.departments && m.departments.length > 0 ? (
                              m.departments.map((d) => (
                                <span
                                  key={d.department}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xs ${
                                    DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-muted border border-border'
                                  }`}
                                >
                                  {DEPARTMENTS[d.department]?.label} (سطح {d.level})
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted font-medium">—</span>
                            )}
                          </div>

                          {/* Relative Progress */}
                          <div className="col-span-2 px-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-muted mb-1">
                              <span>{scorePct}٪</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  actualRank === 1
                                    ? 'bg-gradient-to-r from-amber-400 to-[#F8A41D]'
                                    : 'bg-gradient-to-r from-[#59BBAF] to-[#202A5A]'
                                }`}
                               style={{ width: `${scorePct}%` }}
                              />
                            </div>
                          </div>

                          {/* XP and Action */}
                          <div className="col-span-2 flex items-center justify-between pl-1">
                            <div className="flex items-center gap-1 rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 border border-[#F8A41D]/40 px-3 py-1.5 text-xs sm:text-sm font-black text-[#BA7B16] dark:text-[#fde047] shadow-2xs">
                              <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                              <span>{m.xp_total.toLocaleString('fa-IR')}</span>
                            </div>
                            <span className="rounded-lg bg-surface-2 border border-border p-1.5 text-muted group-hover:text-action group-hover:border-action/40 transition-colors">
                              <ChevronLeft className="h-4 w-4" />
                            </span>
                          </div>
                        </div>

                        {/* Mobile Row Card Layout */}
                        <div className="flex md:hidden flex-col gap-3">
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-xs ${
                                  actualRank === 1
                                    ? 'bg-amber-400 text-amber-950 font-black'
                                    : actualRank === 2
                                    ? 'bg-slate-300 text-slate-900 font-black'
                                    : actualRank === 3
                                    ? 'bg-amber-700 text-white font-black'
                                    : 'bg-surface-2 border border-border text-muted font-bold'
                                }`}
                              >
                                {actualRank === 1 ? (
                                  <span className="flex items-center gap-0.5"><Crown className="h-3 w-3 fill-current" />۱</span>
                                ) : actualRank === 2 ? (
                                  <span className="flex items-center gap-0.5"><Medal className="h-3 w-3" />۲</span>
                                ) : actualRank === 3 ? (
                                  <span className="flex items-center gap-0.5"><Medal className="h-3 w-3" />۳</span>
                                ) : (
                                  actualRank.toLocaleString('fa-IR')
                                )}
                              </div>

                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#59BBAF] to-[#202A5A] text-xs font-black text-white overflow-hidden"
                              >
                                {m.avatar_url ? (
                                  <img src={m.avatar_url} alt={m.full_name} className="h-full w-full object-cover" />
                                ) : (
                                  m.full_name.charAt(0)
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h3 className="truncate text-xs font-bold text-default group-hover:text-action">
                                    {m.full_name}
                                  </h3>
                                  {isCurrentUser && (
                                    <span className="rounded-full bg-action/20 text-action text-[9px] font-black px-1.5 py-0.2">
                                      شما
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 rounded-xl bg-[#FEF6E8] dark:bg-[#57390A]/40 border border-[#F8A41D]/30 px-2.5 py-1 text-xs font-black text-[#BA7B16] dark:text-[#fde047]">
                              <Zap className="h-3.5 w-3.5 text-[#F8A41D]" />
                              <span>{m.xp_total.toLocaleString('fa-IR')} XP</span>
                            </div>
                          </div>

                          {m.departments && m.departments.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mr-10">
                              {m.departments.map((d) => (
                                <span
                                  key={d.department}
                                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                                    DEPARTMENTS[d.department]?.badgeClass || 'bg-surface-2 text-muted border border-border'
                                  }`}
                                >
                                  {DEPARTMENTS[d.department]?.label} (سطح {d.level})
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mr-10">
                            <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#59BBAF] to-[#202A5A] transition-all duration-500"
                                style={{ width: `${scorePct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Member Profile Modal */}
      <MemberProfileModal
        userId={selectedMemberId}
        isOpen={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        currentProfile={profile}
        initialMember={members.find((m) => m.id === selectedMemberId) || null}
        isAdmin={profile?.role === 'admin'}
        onXpChanged={(id, newXp) => {
          setMembers((prev) =>
            prev.map((m) => (m.id === id ? { ...m, xp_total: newXp } : m)).sort((a, b) => b.xp_total - a.xp_total)
          )
        }}
      />
    </div>
  )
}
