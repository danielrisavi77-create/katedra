import type { SupabaseClient } from '@supabase/supabase-js'

export type ProjectLookup = {
  projectId: string
  guestProjectId: string
}

type ProjectRow = {
  user_id: string
  project_id: string | null
  guest_project_id: string | null
}

// The checked-in Database projection intentionally contains only the
// entitlement contract. Project compatibility rows are owned by the Lekta
// schema and are consumed here through the runtime client shape.
type ProjectDb = SupabaseClient<any>

async function findBy(db: ProjectDb, userId: string, column: 'project_id' | 'guest_project_id', value: string) {
  let result
  try {
    result = await db
      .from('katedra_projects')
      .select('user_id, project_id, guest_project_id')
      .eq('user_id', userId)
      .eq(column, value)
      .maybeSingle()
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'owned_project_lookup_failed', userId, lookupColumn: column, error: error?.message,
    }))
    return null
  }
  const { data, error } = result

  if (error) return null
  return data as ProjectRow | null
}

export async function resolveOwnedProject(
  db: ProjectDb,
  input: { userId: string; projectId: string; allowGuestAlias?: boolean },
): Promise<ProjectLookup | null> {
  const { userId, projectId, allowGuestAlias = true } = input
  if (!userId || !projectId) return null

  const row = await findBy(db, userId, 'project_id', projectId)
    ?? (allowGuestAlias ? await findBy(db, userId, 'guest_project_id', projectId) : null)

  if (!row?.project_id) return null
  return {
    projectId: row.project_id,
    guestProjectId: row.guest_project_id || row.project_id,
  }
}
