import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject }))

import { GET, PUT } from './route'

function request(body) {
  return new Request('http://localhost/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('PUT /api/state ownership guard', () => {
  it('resolves the owned project before building the upsert', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          upsert() { return query },
          maybeSingle: vi.fn().mockResolvedValue({ data: { project_id: 'project-1' }, error: null }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await PUT(request({ projectId: 'project-1', workTypeCanonical: 'seminar', topic: 'Tema' }))

    expect(response.status).not.toBe(500)
    expect(mocks.resolveOwnedProject).toHaveBeenCalledWith(
      expect.anything(),
      { userId: 'user-1', projectId: 'project-1' },
    )
  })

  it('rejects an unknown project before writing state', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.resolveOwnedProject.mockResolvedValue(null)

    const response = await PUT(request({ projectId: 'other-project', workTypeCanonical: 'seminar' }))

    expect(response.status).toBe(404)
  })

  it('allows the first authenticated sync of an explicitly carried guest project', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    let written
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          upsert(value) { written = value; return query },
          maybeSingle: vi.fn().mockResolvedValue({ data: { project_id: 'guest-project' }, error: null }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue(null)

    const response = await PUT(request({
      projectId: 'guest-project',
      guestProjectId: 'guest-project',
      workTypeCanonical: 'seminar',
      topic: 'Nova tema',
    }))

    expect(response.status).toBe(200)
    expect(written).toMatchObject({ user_id: 'user-1', project_id: 'guest-project', guest_project_id: 'guest-project' })
  })

  it('returns a conflict when canonical project ownership rejects the sync', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          upsert() { return query },
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'Academic Suite project ownership conflict' },
          }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue(null)

    const response = await PUT(request({
      projectId: 'guest-project',
      guestProjectId: 'guest-project',
      workTypeCanonical: 'seminar',
      topic: 'Nova tema',
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Projekt je već povezan s drugim računom ili projektom.',
    })
  })

  it('persists only structured Lekta issue metadata', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    let written
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          upsert(value) { written = value; return query },
          maybeSingle: vi.fn().mockResolvedValue({ data: { project_id: 'project-1' }, error: null }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await PUT(request({
      projectId: 'project-1',
      workTypeCanonical: 'seminar',
      lektaIssues: [{
        id: 'issue-1',
        ruleId: 'rule-1',
        checkId: 'citations',
        severity: 'warning',
        category: 'citations',
        fixable: true,
        fixerId: 'fix-citation',
        label: 'Dodajte izvor.',
        status: 'OPEN',
        detail: 'Citat bez izvora na stranici 12.',
        location: { page: 12, excerpt: 'Document-derived passage.' },
        sourcePassage: 'Document-derived source passage.',
        documentText: 'Document-derived text that must remain local.',
        mentorComment: 'Pitaj mentora.',
        unknownKey: 'must not persist',
      }, {
        id: 'issue-oversized-label',
        severity: 'info',
        category: 'formatting',
        fixable: false,
        label: 'x'.repeat(281),
        status: 'OPEN',
      }],
    }))

    expect(response.status).toBe(200)
    expect(written.lekta_issues).toEqual([{
      id: 'issue-1',
      ruleId: 'rule-1',
      checkId: 'citations',
      severity: 'warning',
      category: 'citations',
      fixable: true,
      fixerId: 'fix-citation',
      label: 'Dodajte izvor.',
      status: 'OPEN',
    }, {
      id: 'issue-oversized-label',
      severity: 'info',
      category: 'formatting',
      fixable: false,
      status: 'OPEN',
    }])
  })

  it('sanitizes contaminated Lekta issues returned from stored state', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              project_id: 'project-1',
              lekta_issues: [{
                id: 'issue-1',
                severity: 'warning',
                category: 'citations',
                fixable: true,
                label: 'Dodajte izvor.',
                status: 'OPEN',
                detail: 'Citat bez izvora na stranici 12.',
                location: { page: 12, excerpt: 'Document-derived passage.' },
                sourcePassage: 'Document-derived source passage.',
                documentText: 'Document-derived text that must remain local.',
                mentorComment: 'Pitaj mentora.',
                unknownKey: 'must not return',
              }],
            },
            error: null,
          }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await GET(new Request('http://localhost/api/state?projectId=project-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.lektaIssues).toEqual([{
      id: 'issue-1',
      severity: 'warning',
      category: 'citations',
      fixable: true,
      label: 'Dodajte izvor.',
      status: 'OPEN',
    }])
  })
})
