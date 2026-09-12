import type { Profile } from './database.types'

let memoryProfile: Profile | null = null

export function getCachedProfile(): Profile | null {
  if (memoryProfile) return memoryProfile
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rotello-user-profile')
      if (stored) {
        memoryProfile = JSON.parse(stored)
        return memoryProfile
      }
    } catch {
      // ignore
    }
  }
  return null
}

export function setCachedProfile(profile: Profile | null) {
  memoryProfile = profile
  if (typeof window !== 'undefined') {
    try {
      if (profile) {
        localStorage.setItem('rotello-user-profile', JSON.stringify(profile))
      } else {
        localStorage.removeItem('rotello-user-profile')
      }
    } catch {
      // ignore
    }
  }
}
