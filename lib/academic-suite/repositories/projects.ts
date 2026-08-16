import type { SupabaseClient } from '@supabase/supabase-js'

export type ProjectLookup = {
  projectId: string
  guestProjectId: string
}

export type ProjectLookupResult =
  | { ok: true; value: ProjectLookup | null }
  | { ok: false; error: string }

type ProjectRow = {
  user_id: string
  project_id: string | null
  guest_project_id: string | null
}

// The checked-in Database projection intentionally contains only the
// entitlement contract. Project compatibility rows are owned by the Lekta
// schema and are consumed here through the runtime client shape.
type ProjectDb = SupabaseClient<any>

async function findByResult(db: ProjectDb, userId: string, column: 'project_id' | 'guest_project_id', value: string): Promise<{ ok: true; value: ProjectRow | null } | { ok: false; error: string }> {
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
    return { ok: false, error: error instanceof Error ? error.message : 'Owned project lookup failed.' }
  }
  const { data, error } = result
  if (error) return { ok: false, error: error.message || 'Owned project lookup failed.' }
  return { ok: true, value: data as ProjectRow | null }
}

export async function resolveOwnedProjectResult(
  db: ProjectDb,
  input: { userId: string; projectId: string; allowGuestAlias?: boolean },
): Promise<ProjectLookupResult> {
  const { userId, projectId, allowGuestAlias = true } = input
  if (!userId || !projectId) return { ok: true, value: null }

  const byCanonical = await findByResult(db, userId, 'project_id', projectId)
  if (byCanonical.ok === false) {
    console.error(JSON.stringify({ eventName: 'owned_project_lookup_failed', userId, lookupColumn: 'project_id', error: byCanonical.error }))
    return byCanonical
  }
  if (byCanonical.value) {
    return projectLookupFromRow(byCanonical.value)
  }

  if (!allowGuestAlias) return { ok: true, value: null }
  const byGuest = await findByResult(db, userId, 'guest_project_id', projectId)
  if (byGuest.ok === false) {
    console.error(JSON.stringify({ eventName: 'owned_project_lookup_failed', userId, lookupColumn: 'guest_project_id', error: byGuest.error }))
    return byGuest
  }
  return projectLookupFromRow(byGuest.value)
}

function projectLookupFromRow(row: ProjectRow | null): ProjectLookupResult {
  if (!row?.project_id) return { ok: true, value: null }
  return {
    ok: true,
    value: {
      projectId: row.project_id,
      guestProjectId: row.guest_project_id || row.project_id,
    },
  }
}

export async function resolveOwnedProject(
  db: ProjectDb,
  input: { userId: string; projectId: string; allowGuestAlias?: boolean },
): Promise<ProjectLookup | null> {
  const result = await resolveOwnedProjectResult(db, input)
  return result.ok ? result.value : null
}
