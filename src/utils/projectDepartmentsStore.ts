import fs from 'fs'
import path from 'path'
import { createAdminClient } from '@/utils/supabase/admin'
import type { DepartmentKey } from '@/utils/database.types'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE_PATH = path.join(DATA_DIR, 'project_departments.json')

export const VALID_DEPARTMENTS: DepartmentKey[] = ['engineers', 'artists', 'generalists']

function readLocalDepartments(): Record<string, DepartmentKey[]> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({}), 'utf8')
      return {}
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeLocalDepartments(data: Record<string, DepartmentKey[]>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8')
  } catch {
    // Ignore fs errors in serverless/readonly environments
  }
}

/**
 * Returns a map of projectId -> DepartmentKey[]
 * Merges Supabase tasks/roster tasks if any with local persisted JSON
 */
export async function getAllProjectDepartmentsMap(): Promise<Record<string, DepartmentKey[]>> {
  const result: Record<string, Set<DepartmentKey>> = {}

  // 1. Read from local store
  try {
    const local = readLocalDepartments()
    for (const [projId, deps] of Object.entries(local)) {
      if (!result[projId]) result[projId] = new Set()
      deps.forEach((d) => {
        if (VALID_DEPARTMENTS.includes(d)) result[projId].add(d)
      })
    }
  } catch (err) {
    console.error('Error reading local project departments:', err)
  }

  // 2. Check Supabase projects table if a single 'department' column exists
  try {
    const admin = createAdminClient()
    const { data: projs } = await admin.from('projects').select('id, description')
    if (projs) {
      for (const p of projs) {
        if (!result[p.id]) result[p.id] = new Set()
        // Check if description has embedded departments tag e.g. [DEPS:engineers,artists]
        if (p.description && p.description.includes('[DEPS:')) {
          const match = p.description.match(/\[DEPS:([^\]]+)\]/)
          if (match && match[1]) {
            match[1].split(',').forEach((d: string) => {
              const trimmed = d.trim() as DepartmentKey
              if (VALID_DEPARTMENTS.includes(trimmed)) {
                result[p.id].add(trimmed)
              }
            })
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  const finalMap: Record<string, DepartmentKey[]> = {}
  for (const [projId, set] of Object.entries(result)) {
    finalMap[projId] = Array.from(set)
  }
  return finalMap
}

/**
 * Get departments for a single project
 */
export async function getProjectDepartments(projectId: string): Promise<DepartmentKey[]> {
  const map = await getAllProjectDepartmentsMap()
  return map[projectId] || []
}

/**
 * Set departments for a single project
 */
export async function setProjectDepartments(
  projectId: string,
  departments: DepartmentKey[]
): Promise<DepartmentKey[]> {
  const valid = departments.filter((d) => VALID_DEPARTMENTS.includes(d))

  // 1. Write to local file
  try {
    const local = readLocalDepartments()
    local[projectId] = valid
    writeLocalDepartments(local)
  } catch (err) {
    console.error('Error writing local departments:', err)
  }

  // 2. Also persist tag in project description in Supabase as a bulletproof cloud backup
  try {
    const admin = createAdminClient()
    const { data: proj } = await admin
      .from('projects')
      .select('description')
      .eq('id', projectId)
      .single()

    if (proj) {
      let desc = proj.description || ''
      // Remove existing [DEPS:...] tag
      desc = desc.replace(/\s*\[DEPS:[^\]]*\]/g, '').trim()
      if (valid.length > 0) {
        const tag = `[DEPS:${valid.join(',')}]`
        desc = desc ? `${desc} ${tag}` : tag
      }
      await admin.from('projects').update({ description: desc || null }).eq('id', projectId)
    }
  } catch (err) {
    console.error('Error syncing departments to Supabase project description:', err)
  }

  return valid
}

/**
 * Clean description by removing embedded [DEPS:...] tag for clean UI display
 */
export function cleanProjectDescription(desc: string | null | undefined): string {
  if (!desc) return ''
  return desc.replace(/\s*\[DEPS:[^\]]*\]/g, '').trim()
}
