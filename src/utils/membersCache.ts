import type { Profile } from '@/utils/database.types'

interface CacheEntry {
  data: Profile[]
  timestamp: number
}

let membersCache: CacheEntry | null = null
const CACHE_TTL_MS = 5000 // 5 seconds

export function getCachedMembers(): Profile[] | null {
  const now = Date.now()
  if (membersCache && now - membersCache.timestamp < CACHE_TTL_MS) {
    return membersCache.data
  }
  return null
}

export function setCachedMembers(data: Profile[]) {
  membersCache = {
    data,
    timestamp: Date.now(),
  }
}

export function invalidateMembersCache() {
  membersCache = null
}
