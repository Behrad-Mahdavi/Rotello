export interface JalaaliDate {
  jy: number
  jm: number
  jd: number
}

export interface GregorianDate {
  gy: number
  gm: number
  gd: number
}

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

export const PERSIAN_WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
export const PERSIAN_WEEK_DAYS_FULL = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
]

export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return n.toString().replace(/\d/g, (d) => farsiDigits[parseInt(d, 10)])
}

function div(a: number, b: number) {
  return ~~(a / b)
}

function mod(a: number, b: number) {
  return a - ~~(a / b) * b
}

export function toJalaali(gy: number, gm: number, gd: number): JalaaliDate {
  return d2j(g2d(gy, gm, gd))
}

export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd))
}

export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean {
  return (
    jy >= -61 &&
    jy <= 3177 &&
    jm >= 1 &&
    jm <= 12 &&
    jd >= 1 &&
    jd <= jalaaliMonthLength(jy, jm)
  )
}

export function isLeapJalaaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  if (isLeapJalaaliYear(jy)) return 30
  return 29
}

function jalCal(jy: number) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]
  let jm: number
  let jump: number
  let leap: number
  let n: number
  let i: number

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('Invalid Jalaali year ' + jy)
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  n = jy - jp

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump!, 33) === 4 && jump! - n === 4) leapJ += 1

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG

  if (jump! - n < 6) n = n - jump! + div(jump! + 4, 33) * 33
  leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4

  return { leap, gy, march }
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn: number): JalaaliDate {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let jd: number
  let jm: number
  let k: number

  k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31)
      jd = mod(k, 31) + 1
      return { jy, jm, jd }
    } else {
      k -= 186
    }
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  jm = 7 + div(k, 30)
  jd = mod(k, 30) + 1
  return { jy, jm, jd }
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

// Helper: Convert YYYY-MM-DD (Gregorian) to JalaaliDate
export function parseGregorianToJalaali(dateStr: string | null | undefined): JalaaliDate | null {
  if (!dateStr) return null
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const gy = parseInt(match[1], 10)
    const gm = parseInt(match[2], 10)
    const gd = parseInt(match[3], 10)
    return toJalaali(gy, gm, gd)
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// Helper: Format Jalaali date to Gregorian YYYY-MM-DD string
export function formatJalaaliToGregorianString(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd)
  const mm = g.gm.toString().padStart(2, '0')
  const dd = g.gd.toString().padStart(2, '0')
  return `${g.gy}-${mm}-${dd}`
}

// Helper: Format Gregorian date string to Persian text representation
export function formatToPersianDate(dateStr: string | null | undefined, mode: 'short' | 'long' = 'long'): string {
  try {
    const j = parseGregorianToJalaali(dateStr)
    if (!j) return 'نامشخص'
    if (mode === 'short') {
      return `${toPersianDigits(j.jy)}/${toPersianDigits(j.jm.toString().padStart(2, '0'))}/${toPersianDigits(j.jd.toString().padStart(2, '0'))}`
    }
    const month = PERSIAN_MONTHS[j.jm - 1] || ''
    return `${toPersianDigits(j.jd)} ${month} ${toPersianDigits(j.jy)}`.trim()
  } catch {
    return 'نامشخص'
  }
}
