import { describe, expect, it } from 'vitest'

import { resolveOwnedProject } from './projects'

function createProjectDb(rows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      expect(table).toBe('katedra_projects')
      const filters: Array<[string, unknown]> = []
      const query = {
        select() { return query },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return query
        },
        async maybeSingle() {
          const data = rows.find((row) => filters.every(([column, value]) => row[column] === value)) ?? null
          return { data, error: null }
        },
      }
      return query
    },
  }
}

describe('resolveOwnedProject', () => {
  it('resolves a canonical project id from a legacy guest alias', async () => {
    await expect(resolveOwnedProject(createProjectDb([
      { user_id: 'user-1', project_id: 'project-uuid', guest_project_id: 'klegacy' },
    ]) as never, { userId: 'user-1', projectId: 'klegacy' })).resolves.toEqual({
      projectId: 'project-uuid',
      guestProjectId: 'klegacy',
    })
  })

  it('rejects a project owned by another user', async () => {
    await expect(resolveOwnedProject(createProjectDb([
      { user_id: 'user-2', project_id: 'project-uuid', guest_project_id: 'klegacy' },
    ]) as never, { userId: 'user-1', projectId: 'project-uuid' })).resolves.toBeNull()
  })

  it('can require the canonical project id for authenticated operations', async () => {
    await expect(resolveOwnedProject(createProjectDb([
      { user_id: 'user-1', project_id: 'project-uuid', guest_project_id: 'klegacy' },
    ]) as never, { userId: 'user-1', projectId: 'klegacy', allowGuestAlias: false })).resolves.toBeNull()
  })

  it('fails closed when the project client throws', async () => {
    await expect(resolveOwnedProject({
      from() { throw new Error('database unavailable') },
    } as never, { userId: 'user-1', projectId: 'project-uuid' })).resolves.toBeNull()
  })
})
