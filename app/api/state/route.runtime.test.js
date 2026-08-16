import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({
  resolveOwnedProject: mocks.resolveOwnedProject,
  resolveOwnedProjectResult: mocks.resolveOwnedProjectResult,
}))

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

beforeEach(() => {
  mocks.resolveOwnedProjectResult.mockImplementation(async (...args) => ({
    ok: true,
    value: await mocks.resolveOwnedProject(...args),
  }))
})

describe('PUT /api/state ownership guard', () => {
  it('fails closed when the owned-project lookup is unavailable', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: false, error: 'database unavailable' })

    const response = await PUT(request({ projectId: 'guest-project', guestProjectId: 'guest-project', workTypeCanonical: 'seminar', topic: 'Tema' }))

    expect(response.status).toBe(503)
  })

  it('fails closed in production when project-lock enforcement is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const response = await PUT(request({ projectId: 'project-1', workTypeCanonical: 'seminar', topic: 'Nova tema' }))

    expect(response.status).toBe(503)
    expect(mocks.resolveOwnedProject).not.toHaveBeenCalled()
  })

  it('fails closed in production when GET cannot report project-lock state', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })

    const response = await GET(new Request('http://localhost/api/state?projectId=project-1'))

    expect(response.status).toBe(503)
    expect(mocks.resolveOwnedProject).not.toHaveBeenCalled()
  })

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

  it('maps a canonical database lock violation to a conflict when the lock appears during the write', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from(table) {
        const query = {
          select() { return query },
          eq() { return query },
          upsert() {
            if (table === 'katedra_projects') return query
            return query
          },
          maybeSingle: vi.fn().mockResolvedValue(
            table === 'katedra_project_locks'
              ? { data: null, error: null }
              : { data: null, error: { code: '23514', message: 'Locked Katedra project identity is immutable' } },
          ),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await PUT(request({ projectId: 'project-1', workTypeCanonical: 'seminar', topic: 'Nova tema' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Tema je zaključana nakon naplate. Za novu temu potreban je novi projekt i Pass.',
    })
  })

  it('rejects an unknown project before writing state', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.resolveOwnedProject.mockResolvedValue(null)

    const response = await PUT(request({ projectId: 'other-project', workTypeCanonical: 'seminar' }))

    expect(response.status).toBe(404)
  })

  it('rejects a non-string topic before writing project metadata', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await PUT(request({
      projectId: 'project-1',
      workTypeCanonical: 'seminar',
      topic: { prompt: 'nevaljan topic' },
    }))

    expect(response.status).toBe(400)
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

  it('does not let a submitted guest alias overwrite the canonical project alias', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    let written
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          upsert(value) { written = value; return query },
          maybeSingle: vi.fn().mockResolvedValue({ data: { project_id: 'canonical-project-1' }, error: null }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({
      projectId: 'canonical-project-1',
      guestProjectId: 'canonical-guest-1',
    })

    const response = await PUT(request({
      projectId: 'canonical-project-1',
      guestProjectId: 'stale-or-other-project-alias',
      workTypeCanonical: 'seminar',
      topic: 'Tema',
    }))

    expect(response.status).toBe(200)
    expect(written).toMatchObject({
      project_id: 'canonical-project-1',
      guest_project_id: 'canonical-guest-1',
    })
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
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(body.lektaIssues).toEqual([{
      id: 'issue-1',
      severity: 'warning',
      category: 'citations',
      fixable: true,
      label: 'Dodajte izvor.',
      status: 'OPEN',
    }])
  })

  it('does not report a missing state row as an empty successful project', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        return query
      },
    })
    mocks.resolveOwnedProject.mockResolvedValue({ projectId: 'project-1', guestProjectId: 'guest-1' })

    const response = await GET(new Request('http://localhost/api/state?projectId=project-1'))

    expect(response.status).toBe(404)
  })

  it('keeps synced legacy metadata structured and bounded', async () => {
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
      topic: 'Tema',
      checks: {
        'outline-ready': true,
        'mentor-comment': false,
        leakedText: 'tajni akademski sadržaj',
        nested: { prompt: 'ne smije u shared state' },
      },
      gen: {
        f_fakultet: 'FPZG',
        f_izvori: 'cijeli tekst rada koji ne smije završiti u shared state'.repeat(20),
        wc_total: '1200',
        f_brutal: 'yes',
        aiAck: {
          generate_large_sections: { factId: 'fact-1', factVerifiedDate: '2026-08-15', ackedAt: 123 },
          injected: { prompt: 'tajni akademski tekst' },
        },
      },
      hist: [{ t: 'not-a-timestamp', mode: 'write', tip: 'x'.repeat(500), prompt: 'tajni tekst' }],
      log: [{
        t: 123,
        kind: 'session_started',
        files: ['draft.docx', 'x'.repeat(500)],
        done: 'yes',
        lekta_result: { score: 99, issueCount: 1, findingIds: ['issue-1'], detail: 'tajni tekst' },
        txt: 'tajni tekst',
      }],
      logf: {
        prompt: 'tajni akademski tekst koji ne smije u shared state',
        response: 'sirovi AI odgovor',
      },
    }))

    expect(response.status).toBe(200)
    expect(written.checks).toEqual({ 'outline-ready': true, 'mentor-comment': false })
    expect(written.gen).toEqual({
      f_fakultet: 'FPZG',
      wc_total: 1200,
      aiAck: {
        generate_large_sections: { factId: 'fact-1', factVerifiedDate: '2026-08-15', ackedAt: 123 },
      },
    })
    expect(written.hist).toEqual([])
    expect(written.log).toEqual([{
      t: 123,
      kind: 'session_started',
      files: ['draft.docx'],
      lekta_result: { score: 99, issueCount: 1, findingIds: ['issue-1'] },
    }])
    expect(written).not.toHaveProperty('logf')
  })

  it('sanitizes legacy gen, history and ledger values when reading state', async () => {
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
              checks: { 'outline-ready': true, leakedText: 'tajni tekst', nested: { prompt: 'tajni prompt' } },
              gen: { f_fakultet: 'FPZG', f_izvori: 'tajni tekst', wc_total: '1200', f_brutal: 'yes' },
              hist: [{ t: 'not-a-timestamp', prompt: 'tajni tekst' }],
              log: [{ t: 123, kind: 'ai_response', txt: 'tajni AI odgovor', done: 'yes' }],
              logf: { prompt: 'tajni AI prompt' },
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
    expect(body.checks).toEqual({ 'outline-ready': true })
    expect(body.gen).toEqual({ f_fakultet: 'FPZG', wc_total: 1200 })
    expect(body.hist).toEqual([])
    expect(body.log).toEqual([{ t: 123, kind: 'ai_response' }])
    expect(body).not.toHaveProperty('logf')
  })
})
