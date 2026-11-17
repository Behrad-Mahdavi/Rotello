/**
 * Muse Agent — shared auth helpers
 *
 * Required env vars:
 *   MUSE_API_TOKEN      – long random hex string, compared with timingSafeEqual
 *   MUSE_ADMIN_USER_ID  – UUID of a real admin profile used as reviewed_by / created_by
 */

import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'

/** Hard cap on XP that the Muse agent may award in a single request. */
export const MUSE_MAX_XP = 1000

/**
 * Returns true only when the Authorization header carries a valid Bearer token
 * that exactly matches MUSE_API_TOKEN.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyMuseToken(authHeader: string | null | undefined): boolean {
  const envToken = process.env.MUSE_API_TOKEN
  if (!envToken) return false
  if (!authHeader?.startsWith('Bearer ')) return false

  const incoming = authHeader.slice(7)
  try {
    const a = Buffer.from(incoming, 'utf8')
    const b = Buffer.from(envToken, 'utf8')
    // Lengths must match; if not, still run comparison on a same-length dummy to
    // avoid early-exit timing leaks, then return false.
    if (a.length !== b.length) {
      timingSafeEqual(b, b) // dummy op, constant time
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Returns the UUID of the admin identity that Muse acts as.
 * Prefers MUSE_ADMIN_USER_ID env var; falls back to the first admin profile in DB.
 */
export async function getMuseAdminId(): Promise<string | null> {
  const envId = process.env.MUSE_ADMIN_USER_ID?.trim()
  if (envId) return envId

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()
    return data?.id ?? null
  } catch {
    return null
  }
}
