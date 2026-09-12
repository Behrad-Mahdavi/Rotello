export type DepartmentKey = 'engineers' | 'artists' | 'generalists'
export type DepartmentLevel = 'A' | 'B'

export interface DepartmentConfig {
  key: DepartmentKey
  label: string
  shortLabel: string
  description: string
  badgeClass: string
  borderClass: string
  bgClass: string
  textClass: string
  ringClass: string
  dotColor: string
}

export const DEPARTMENTS: Record<DepartmentKey, DepartmentConfig> = {
  engineers: {
    key: 'engineers',
    label: 'مهندسا',
    shortLabel: 'مهندسی',
    description: 'تیم فنی، برنامه‌نویسی و توسعه',
    badgeClass: 'bg-[#EEF8F7] text-[#1F413D] border border-[#59BBAF]/40 dark:bg-[#1F413D]/40 dark:text-[#EEF8F7]',
    borderClass: 'border-[#59BBAF]/40',
    bgClass: 'bg-[#EEF8F7] dark:bg-[#1F413D]/30',
    textClass: 'text-[#438C83] dark:text-[#59BBAF]',
    ringClass: 'ring-[#59BBAF]/40',
    dotColor: '#59BBAF',
  },
  artists: {
    key: 'artists',
    label: 'آرتیستا',
    shortLabel: 'آرت و دیزاین',
    description: 'تیم طراحی، گرافیک، موشن و هنر',
    badgeClass: 'bg-[#F0EAF4] text-[#4C226C] border border-[#652D90]/40 dark:bg-[#231032]/60 dark:text-[#F0EAF4]',
    borderClass: 'border-[#652D90]/40',
    bgClass: 'bg-[#F0EAF4] dark:bg-[#231032]/30',
    textClass: 'text-[#652D90] dark:text-[#C084FC]',
    ringClass: 'ring-[#652D90]/40',
    dotColor: '#652D90',
  },
  generalists: {
    key: 'generalists',
    label: 'آچارفرانسه‌ها',
    shortLabel: 'آچارفرانسه',
    description: 'تیم همه‌فن‌حریف، عملیات و چندمهارتی',
    badgeClass: 'bg-[#FEF6E8] text-[#57390A] border border-[#F8A41D]/40 dark:bg-[#57390A]/40 dark:text-[#FEF6E8]',
    borderClass: 'border-[#F8A41D]/40',
    bgClass: 'bg-[#FEF6E8] dark:bg-[#57390A]/30',
    textClass: 'text-[#BA7B16] dark:text-[#F8A41D]',
    ringClass: 'ring-[#F8A41D]/40',
    dotColor: '#F8A41D',
  },
}

export const DEPARTMENT_KEYS: DepartmentKey[] = ['engineers', 'artists', 'generalists']

export function getDepartmentConfig(key: string | null | undefined): DepartmentConfig | null {
  if (!key || !(key in DEPARTMENTS)) return null
  return DEPARTMENTS[key as DepartmentKey]
}

export function getDepartmentLabel(key: string | null | undefined): string {
  const conf = getDepartmentConfig(key)
  return conf ? conf.label : 'بدون دپارتمان'
}

export function getRoleInfo(role: string | null | undefined) {
  switch (role) {
    case 'admin':
      return {
        label: 'راهبر',
        colorClass: 'bg-[#F0EAF4] text-[#4C226C] border border-[#652D90]/40 dark:bg-[#231032]/60 dark:text-[#F0EAF4]',
        badgeGradient: 'from-[#652D90] to-[#4C226C]',
        dotColor: '#652D90',
      }
    case 'mentor':
      return {
        label: 'منتور',
        colorClass: 'bg-[#E9EAEF] text-[#0B0F1F] border border-[#202A5A]/40 dark:bg-[#0B0F1F]/60 dark:text-[#E9EAEF]',
        badgeGradient: 'from-[#202A5A] to-[#182044]',
        dotColor: '#202A5A',
      }
    case 'member':
    default:
      return {
        label: 'عضو',
        colorClass: 'bg-[#EEF8F7] text-[#1F413D] border border-[#59BBAF]/40 dark:bg-[#1F413D]/40 dark:text-[#EEF8F7]',
        badgeGradient: 'from-[#59BBAF] to-[#438C83]',
        dotColor: '#59BBAF',
      }
  }
}
