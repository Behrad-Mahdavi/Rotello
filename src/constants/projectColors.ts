export type ProjectColorKey = 'emerald' | 'indigo' | 'purple' | 'amber' | 'rose' | 'cyan'

export interface ProjectColorConfig {
  key: ProjectColorKey
  label: string
  hex: string
  bar: string
  badge: string
  fill: string
  dot: string
  ring: string
  bgLight: string
  border: string
  shadow: string
  shadowHover: string
}

export const PROJECT_COLORS: Record<ProjectColorKey, ProjectColorConfig> = {
  emerald: {
    key: 'emerald',
    label: 'سبز اکوسیستم',
    hex: '#59BBAF',
    bar: 'from-emerald-500 to-teal-600',
    badge: 'from-emerald-500 to-teal-600',
    fill: 'bg-emerald-500',
    dot: '#10b981',
    ring: 'ring-emerald-500/50',
    bgLight: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    border: 'border-[#59BBAF] dark:border-[#59BBAF]',
    shadow: 'shadow-[2.75px_2.75px_0_#59BBAF]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#59BBAF]',
  },
  indigo: {
    key: 'indigo',
    label: 'سرمه‌ای کلاسیک',
    hex: '#202A5A',
    bar: 'from-[#202A5A] to-blue-600',
    badge: 'from-[#202A5A] to-blue-600',
    fill: 'bg-blue-600',
    dot: '#2563eb',
    ring: 'ring-blue-600/50',
    bgLight: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    border: 'border-[#202A5A] dark:border-[#5C6BC0]',
    shadow: 'shadow-[2.75px_2.75px_0_#202A5A] dark:shadow-[2.75px_2.75px_0_#3F50A0]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#202A5A] dark:hover:shadow-[3.75px_3.75px_0_#3F50A0]',
  },
  purple: {
    key: 'purple',
    label: 'بنفش کلاب',
    hex: '#652D90',
    bar: 'from-[#652D90] to-fuchsia-600',
    badge: 'from-[#652D90] to-purple-600',
    fill: 'bg-purple-600',
    dot: '#8b5cf6',
    ring: 'ring-purple-600/50',
    bgLight: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    border: 'border-[#652D90] dark:border-[#9C4FD8]',
    shadow: 'shadow-[2.75px_2.75px_0_#652D90] dark:shadow-[2.75px_2.75px_0_#8B44C4]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#652D90] dark:hover:shadow-[3.75px_3.75px_0_#8B44C4]',
  },
  amber: {
    key: 'amber',
    label: 'طلایی کالج',
    hex: '#F8A41D',
    bar: 'from-amber-500 to-orange-500',
    badge: 'from-amber-500 to-orange-600',
    fill: 'bg-amber-500',
    dot: '#f59e0b',
    ring: 'ring-amber-500/50',
    bgLight: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    border: 'border-[#F8A41D] dark:border-[#F8A41D]',
    shadow: 'shadow-[2.75px_2.75px_0_#F8A41D]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#F8A41D]',
  },
  rose: {
    key: 'rose',
    label: 'رز مدرن',
    hex: '#E0195B',
    bar: 'from-rose-500 to-pink-600',
    badge: 'from-rose-500 to-pink-600',
    fill: 'bg-rose-500',
    dot: '#f43f5e',
    ring: 'ring-rose-500/50',
    bgLight: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    border: 'border-[#E0195B] dark:border-[#FB7185]',
    shadow: 'shadow-[2.75px_2.75px_0_#E0195B]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#E0195B]',
  },
  cyan: {
    key: 'cyan',
    label: 'آبی اقیانوسی',
    hex: '#0EA5E9',
    bar: 'from-teal-500 to-cyan-600',
    badge: 'from-teal-500 to-cyan-600',
    fill: 'bg-teal-500',
    dot: '#06b6d4',
    ring: 'ring-cyan-500/50',
    bgLight: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    border: 'border-[#0EA5E9] dark:border-[#38BDF8]',
    shadow: 'shadow-[2.75px_2.75px_0_#0EA5E9]',
    shadowHover: 'hover:shadow-[3.75px_3.75px_0_#0EA5E9]',
  },
}

export const PROJECT_COLOR_KEYS: ProjectColorKey[] = ['emerald', 'indigo', 'purple', 'amber', 'rose', 'cyan']

/**
 * Extract color key from project description tag e.g. [COLOR:purple]
 */
export function extractProjectColorKey(desc: string | null | undefined): ProjectColorKey | null {
  if (!desc) return null
  const match = desc.match(/\[COLOR:([a-zA-Z0-9_-]+)\]/)
  if (match && match[1] && match[1] in PROJECT_COLORS) {
    return match[1] as ProjectColorKey
  }
  return null
}

/**
 * Get project color config by description or fallback index
 */
export function getProjectColor(desc: string | null | undefined, fallbackIndex = 0): ProjectColorConfig {
  const extracted = extractProjectColorKey(desc)
  if (extracted && extracted in PROJECT_COLORS) {
    return PROJECT_COLORS[extracted]
  }
  const key = PROJECT_COLOR_KEYS[Math.abs(fallbackIndex) % PROJECT_COLOR_KEYS.length]
  return PROJECT_COLORS[key]
}

/**
 * Clean description removing [DEPS:...] and [COLOR:...]
 */
export function cleanProjectDescription(desc: string | null | undefined): string {
  if (!desc) return ''
  return desc
    .replace(/\s*\[DEPS:[^\]]*\]/g, '')
    .replace(/\s*\[COLOR:[^\]]*\]/g, '')
    .trim()
}
