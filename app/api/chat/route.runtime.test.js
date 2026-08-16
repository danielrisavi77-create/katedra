import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  resolveOwnedProject: vi.fn(),
  resolveOwnedProjectResult: vi.fn(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) })),
  resolveProjectCapability: vi.fn(),
  validateChatRequest: vi.fn(),
  countChatInputChars: vi.fn(),
  countChatAttachmentChars: vi.fn(),
  isDistributedRateLimitConfigured: vi.fn(),
  releaseRateLimitReservation: vi.fn(async (reservation, onError) => {
    try {
      await reservation.release()
      return true
    } catch (error) {
      onError?.(error, 1)
      return false
    }
  }),
  reserveDistributedRequest: vi.fn(),
  reserveUserRequest: vi.fn(),
  ensureFreeStarterGrant: vi.fn(),
  resolveCapability: vi.fn(),
  loadProcessFactsFromDisk: vi.fn(),
  lookupActiveProjectPass: vi.fn(),
  createAnthropicUsageParser: vi.fn(),
  buildBillingConsumeParams: vi.fn(),
  resolveBillingOutcome: vi.fn(),
  authorizeProjectAiRequest: vi.fn(),
  isAdminOverrideUser: vi.fn(),
  validateCostCeiling: vi.fn(),
  estimateChatCharge: vi.fn(),
  maxAffordableOutputTokens: vi.fn(),
  AI_COST_LIMITS: { maxDailyCharge: 100_000 },
  AI_MODEL_COST_MULTIPLIERS: { 'claude-sonnet-5': 1 },
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/academic-suite/repositories/projects', () => ({ resolveOwnedProject: mocks.resolveOwnedProject, resolveOwnedProjectResult: mocks.resolveOwnedProjectResult }))
vi.mock('@/lib/product/server-capabilities', () => ({ resolveProjectCapability: mocks.resolveProjectCapability }))
vi.mock('@/lib/chat/validation', () => ({
  validateChatRequest: mocks.validateChatRequest,
  countChatInputChars: mocks.countChatInputChars,
  countChatAttachmentChars: mocks.countChatAttachmentChars,
}))
vi.mock('@/lib/ai/rate-limit', () => ({
  isDistributedRateLimitConfigured: mocks.isDistributedRateLimitConfigured,
  releaseRateLimitReservation: mocks.releaseRateLimitReservation,
  reserveDistributedRequest: mocks.reserveDistributedRequest,
  reserveUserRequest: mocks.reserveUserRequest,
}))
vi.mock('@/lib/limits', () => ({ MIN_BALANCE: 100 }))
vi.mock('@/lib/katedra-free-starter', () => ({ ensureFreeStarterGrant: mocks.ensureFreeStarterGrant }))
vi.mock('@/lib/academic-suite/process-facts', () => ({ resolveCapability: mocks.resolveCapability }))
vi.mock('@/lib/academic-suite/process-facts.server', () => ({ loadProcessFactsFromDisk: mocks.loadProcessFactsFromDisk }))
vi.mock('@/lib/academic-suite/repositories/entitlements', () => ({ lookupActiveProjectPass: mocks.lookupActiveProjectPass }))
vi.mock('@/lib/ai/anthropic-sse', () => ({ createAnthropicUsageParser: mocks.createAnthropicUsageParser }))
vi.mock('@/lib/ai/billing-contract', () => ({ buildBillingConsumeParams: mocks.buildBillingConsumeParams, resolveBillingOutcome: mocks.resolveBillingOutcome }))
vi.mock('@/lib/ai/project-access', () => ({ authorizeProjectAiRequest: mocks.authorizeProjectAiRequest }))
vi.mock('@/lib/auth/admin-access', () => ({ isAdminOverrideUser: mocks.isAdminOverrideUser }))
vi.mock('@/lib/ai/cost-policy', () => ({
  AI_COST_LIMITS: mocks.AI_COST_LIMITS,
  AI_MODEL_COST_MULTIPLIERS: mocks.AI_MODEL_COST_MULTIPLIERS,
  estimateChatCharge: mocks.estimateChatCharge,
  maxAffordableOutputTokens: mocks.maxAffordableOutputTokens,
  validateCostCeiling: mocks.validateCostCeiling,
}))

import { POST } from './route'

const project = { projectId: '11111111-1111-4111-8111-111111111111', guestProjectId: 'guest-1' }

function request(body = { projectId: project.projectId, messages: [{ role: 'user', content: 'Bok' }] }, extraHeaders = {}) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost', ...extraHeaders },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  mocks.resolveOwnedProjectResult.mockImplementation(async (...args) => ({ ok: true, value: await mocks.resolveOwnedProject(...args) }))
  mocks.isAdminOverrideUser.mockReturnValue(false)
  mocks.estimateChatCharge.mockReturnValue(1_000)
  mocks.maxAffordableOutputTokens.mockReturnValue(8_192)
  mocks.countChatAttachmentChars.mockReturnValue(0)
  mocks.resolveProjectCapability.mockResolvedValue({ allowed: true, code: 'allowed' })
})

describe('POST /api/chat runtime guards', () => {
  it('returns a temporary failure when the project ownership lookup is unavailable', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProjectResult.mockResolvedValue({ ok: false, error: 'projects unavailable' })

    const response = await POST(request())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Projekt trenutačno nije moguće provjeriti.' })
  })

  it('fails closed with a controlled response when the admin client is unavailable', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.createAdminClient.mockImplementation(() => { throw new Error('missing service role') })

    const response = await POST(request())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'AI pristup trenutno nije konfiguriran za siguran rad.' })
  })

  it('rejects a missing chat capability when project locks are enabled', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.resolveOwnedProject.mockResolvedValue(project)

    const response = await POST(request({
      projectId: project.projectId,
      messages: [{ role: 'user', content: 'Napiši cijelo poglavlje.' }],
    }))

    expect(response.status).toBe(400)
    expect(mocks.resolveProjectCapability).not.toHaveBeenCalled()
  })

  it('rejects an unknown chat capability instead of falling through to legacy access', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: 'user-1' } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.resolveOwnedProject.mockResolvedValue(project)

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'legacy_unbounded_generation',
      messages: [{ role: 'user', content: 'Zaobiđi ograničenja.' }],
    }))

    expect(response.status).toBe(400)
    expect(mocks.resolveProjectCapability).not.toHaveBeenCalled()
  })

  it('fails closed and releases the reservation when Pass lookup is unavailable', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: false, error: 'entitlements unavailable' })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(release).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toBeDefined()
  })

  it('uses the strict project capability gate for paid generation when locks are enabled', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    const serverClient = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } }
    mocks.createClient.mockResolvedValue(serverClient)
    mocks.createAdminClient.mockReturnValue({})
    mocks.validateChatRequest.mockReturnValue({ ok: true, value: {} })
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: false, code: 'pass_required', projectId: project.projectId, tier: 'free' })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'generate_large_sections',
      messages: [{ role: 'user', content: 'Napiši tekst.' }],
    }))

    expect(response.status).toBe(402)
    expect(mocks.resolveProjectCapability).toHaveBeenCalledWith(serverClient, {
      userId: 'user-1', projectId: project.projectId, capability: 'full_generation',
    })
  })

  it('blocks generate_submission_text when institutional policy blocks generated submission text', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return { data: { balance: 50_000 }, error: null } },
        }
        return query
      },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.loadProcessFactsFromDisk.mockResolvedValue({})
    mocks.resolveCapability.mockReturnValue({ effective: 'blocked', condition: {}, sourceFactId: 'policy-1', stance: 'banned' })
    vi.stubGlobal('fetch', vi.fn())

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'generate_submission_text',
      messages: [{ role: 'user', content: 'Napiši tekst za predaju.' }],
    }))

    expect(response.status).toBe(403)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('blocks paraphrase_for_submission when institutional policy blocks submission text', async () => {
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return { data: { balance: 50_000 }, error: null } },
        }
        return query
      },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.loadProcessFactsFromDisk.mockResolvedValue({})
    mocks.resolveCapability.mockReturnValue({ effective: 'blocked', condition: {}, sourceFactId: 'policy-1', stance: 'banned' })
    vi.stubGlobal('fetch', vi.fn())

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'paraphrase_for_submission',
      messages: [{ role: 'user', content: 'Preoblikuj ovaj odlomak za predaju.' }],
    }))

    expect(response.status).toBe(403)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('rejects an anonymous request before reading the body', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(mocks.resolveOwnedProject).not.toHaveBeenCalled()
  })

  it('lets the explicit local admin override stream without Pass or wallet gates', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'settled' }, error: null })
    const db = {
      rpc,
      from() { throw new Error('admin override must not read the user wallet or policy rows') },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: {
      id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z',
    } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.resolveProjectCapability.mockResolvedValue({ allowed: true, tier: 'diplomski', projectId: project.projectId, adminOverride: true, unlimited: true })
    mocks.isAdminOverrideUser.mockReturnValue(true)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.createAnthropicUsageParser.mockReturnValue({ push: vi.fn(), finish: vi.fn(), usage: () => ({ inputTokens: 12, outputTokens: 4 }) })
    mocks.buildBillingConsumeParams.mockImplementation((input) => ({
      p_user: input.userId, p_project_id: input.projectId, p_request_id: input.requestId,
      p_charged: input.charged, p_model: input.model, p_in: input.inputTokens, p_out: input.outputTokens,
    }))
    mocks.resolveBillingOutcome.mockReturnValue({ state: 'settled', retry: false })
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode('data: {"type":"message_delta"}\n\n')); controller.close() },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))

    const response = await POST(request({ projectId: project.projectId, capability: 'generate_large_sections', messages: [{ role: 'user', content: 'Napiši tekst.' }] }))
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.lookupActiveProjectPass).not.toHaveBeenCalled()
    expect(mocks.authorizeProjectAiRequest).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('does not let the admin allowlist bypass production Pass and wallet gates', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const db = { rpc: vi.fn() }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: {
      id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z',
    } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.isAdminOverrideUser.mockReturnValue(true)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: false })
    mocks.authorizeProjectAiRequest.mockResolvedValue({ allowed: false, reason: 'no-pass', balance: 0 })

    const response = await POST(request({ projectId: project.projectId, capability: 'contextual_ai', messages: [{ role: 'user', content: 'Bok' }] }))

    expect(response.status).toBe(402)
    expect(mocks.lookupActiveProjectPass).toHaveBeenCalledWith(db, { userId: 'user-daniel', projectId: project.projectId })
    expect(mocks.authorizeProjectAiRequest).toHaveBeenCalledWith(db, {
      userId: 'user-daniel', projectId: project.projectId, hasPass: false,
    })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('lets the local admin override stream without a billing contract and does not call billing RPCs', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', '')
    const release = vi.fn().mockResolvedValue(undefined)
    const rpc = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: {
      id: 'user-daniel', email: 'danielrisavi77@gmail.com', email_confirmed_at: '2026-08-15T10:00:00.000Z',
    } } }) } })
    mocks.createAdminClient.mockReturnValue({ rpc })
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.isAdminOverrideUser.mockReturnValue(true)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(false)
    mocks.reserveUserRequest.mockReturnValue({ allowed: true, release })
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.maxAffordableOutputTokens.mockReturnValue(8_192)
    mocks.estimateChatCharge.mockReturnValue(1_000)
    mocks.createAnthropicUsageParser.mockReturnValue({ push: vi.fn(), finish: vi.fn(), usage: () => ({ inputTokens: 12, outputTokens: 4 }) })
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(encoder.encode('data: {"type":"message_delta"}\n\n')); controller.close() },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))

    const response = await POST(request({ projectId: project.projectId, capability: 'generate_large_sections', messages: [{ role: 'user', content: 'Napiši tekst.' }] }))
    await response.text()

    expect(response.status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('rejects an oversized request body before JSON parsing', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }, { 'content-length': String(33 * 1024 * 1024) }))

    expect(response.status).toBe(413)
    expect(mocks.resolveOwnedProject).not.toHaveBeenCalled()
    expect(mocks.validateChatRequest).not.toHaveBeenCalled()
  })

  it('fails closed in production when the distributed rate-limit store is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(false)

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))

    expect(response.status).toBe(503)
    expect(mocks.reserveUserRequest).not.toHaveBeenCalled()
  })

  it('fails closed in production when project-lock enforcement is not enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    vi.stubEnv('KATEDRA_RATE_LIMIT_STORE', 'supabase')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'false')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'generate_large_sections',
      messages: [{ role: 'user', content: 'Generiraj poglavlje.' }],
    }))

    expect(response.status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('fails closed when the configured distributed reservation RPC is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: false, reason: 'unavailable' })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))

    expect(response.status).toBe(503)
    expect(mocks.reserveDistributedRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user-1' }))
  })

  it('rejects a project that is not owned by the authenticated user', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue(null)
    mocks.validateChatRequest.mockReturnValue({ ok: true })

    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mocks.isDistributedRateLimitConfigured).not.toHaveBeenCalled()
  })

  it('rejects an unknown project with a capability before touching project access state', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue({})
    mocks.resolveOwnedProject.mockResolvedValue(null)
    mocks.validateChatRequest.mockReturnValue({ ok: true })

    const response = await POST(request({
      projectId: 'other-project',
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))

    expect(response.status).toBe(404)
    expect(mocks.isDistributedRateLimitConfigured).not.toHaveBeenCalled()
  })

  it('streams an authenticated response and settles billing with request identity exactly once', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'settled' }, error: null })
    const db = {
      rpc,
      from(table) {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() {
            if (table === 'katedra_wallets') return { data: { balance: 50_000 }, error: null }
            return { data: { unit_id: 'fpzg', gen: {} }, error: null }
          },
        }
        return query
      },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.loadProcessFactsFromDisk.mockResolvedValue({})
    mocks.resolveCapability.mockReturnValue({ effective: 'allowed', condition: {}, sourceFactId: 'test', stance: 'allowed' })
    mocks.createAnthropicUsageParser.mockReturnValue({
      push: vi.fn(),
      finish: vi.fn(),
      usage: () => ({ inputTokens: 12, outputTokens: 4 }),
    })
    mocks.buildBillingConsumeParams.mockImplementation((input) => ({
      p_user: input.userId,
      p_project_id: input.projectId,
      p_request_id: input.requestId,
      p_charged: input.charged,
      p_model: input.model,
      p_in: input.inputTokens,
      p_out: input.outputTokens,
    }))
    mocks.resolveBillingOutcome.mockReturnValue({ state: 'settled', retry: false })
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"message_delta"}\n\n'))
        controller.close()
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }, { 'x-request-id': 'reused-client-id' }))
    const body = await response.text()
    const secondResponse = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }, { 'x-request-id': 'reused-client-id' }))
    await secondResponse.text()

    expect(response.status).toBe(200)
    expect(body).toContain('message_delta')
    expect(response.headers.get('x-request-id')).toBe('reused-client-id')
    expect(secondResponse.status).toBe(200)
    expect(secondResponse.headers.get('x-request-id')).toBe('reused-client-id')

    const reservationInputs = mocks.reserveDistributedRequest.mock.calls.map(([, input]) => input)
    expect(reservationInputs).toHaveLength(2)
    expect(reservationInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 'user-1', requestId: expect.any(String), estimatedCharge: 1_000 }),
    ]))
    const reservationIds = reservationInputs.map(input => input.requestId)
    expect(reservationIds.every(id => id !== 'reused-client-id')).toBe(true)
    expect(new Set(reservationIds).size).toBe(2)

    const billingInputs = rpc.mock.calls
      .filter(([name]) => name === 'katedra_consume')
      .map(([, input]) => input)
    expect(billingInputs).toHaveLength(2)
    expect(billingInputs.map(input => input.p_request_id)).toEqual(reservationIds)
    expect(billingInputs.every(input => input.p_request_id !== 'reused-client-id')).toBe(true)
    expect(release).toHaveBeenCalledTimes(2)
  })

  it('uses the project-scoped v2 balance without requiring the global wallet', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: { status: 'settled' }, error: null }),
      from() {
        return {
          select(columns) {
            if (columns === 'balance') throw new Error('global wallet is unavailable')
            return this
          },
          eq() { return this },
          async maybeSingle() { return { data: { unit_id: 'fpzg', gen: {} }, error: null } },
        }
      },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: false })
    mocks.authorizeProjectAiRequest.mockResolvedValue({ allowed: true, source: 'project_grant', balance: 4_500 })
    mocks.loadProcessFactsFromDisk.mockResolvedValue({})
    mocks.resolveCapability.mockReturnValue({ effective: 'allowed', condition: {}, sourceFactId: 'test', stance: 'allowed' })
    mocks.createAnthropicUsageParser.mockReturnValue({
      push: vi.fn(),
      finish: vi.fn(),
      usage: () => ({ inputTokens: 12, outputTokens: 4 }),
    })
    mocks.buildBillingConsumeParams.mockImplementation((input) => ({
      p_user: input.userId,
      p_project_id: input.projectId,
      p_request_id: input.requestId,
      p_charged: input.charged,
      p_model: input.model,
      p_in: input.inputTokens,
      p_out: input.outputTokens,
    }))
    mocks.resolveBillingOutcome.mockReturnValue({ state: 'settled', retry: false })
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"message_delta"}\n\n'))
        controller.close()
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))
    await response.text()

    expect(response.status).toBe(200)
    expect(mocks.authorizeProjectAiRequest).toHaveBeenCalledWith(db, {
      userId: 'user-1',
      projectId: project.projectId,
      hasPass: false,
    })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('fails closed when project access is allowed without a numeric balance', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const query = {
      select() { return query },
      eq() { return query },
      async maybeSingle() { return { data: { balance: 0 }, error: null } },
    }
    const db = { from: vi.fn(() => query) }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.validateCostCeiling.mockReturnValue({ ok: true })
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: false })
    mocks.authorizeProjectAiRequest.mockResolvedValue({ allowed: true, source: 'project_grant' })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe(`Projektni wallet trenutno nije mogu${String.fromCodePoint(0x0107)}e provjeriti.`)
    expect(release).toHaveBeenCalledTimes(1)
    expect(mocks.validateCostCeiling).toHaveBeenCalled()
  })

  it('releases the reservation before provider access when the estimated charge exceeds balance', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KATEDRA_PROJECT_LOCKS_ENABLED', 'true')
    vi.stubEnv('KATEDRA_BILLING_RPC_CONTRACT', 'v2')
    const release = vi.fn().mockResolvedValue(undefined)
    const db = {
      from() {
        const query = {
          select() { return query },
          eq() { return query },
          async maybeSingle() { return { data: { balance: 10_000 }, error: null } },
        }
        return query
      },
    }
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
    mocks.createAdminClient.mockReturnValue(db)
    mocks.resolveOwnedProject.mockResolvedValue(project)
    mocks.validateChatRequest.mockReturnValue({ ok: true })
    mocks.countChatInputChars.mockReturnValue(3)
    mocks.isDistributedRateLimitConfigured.mockReturnValue(true)
    mocks.reserveDistributedRequest.mockResolvedValue({ allowed: true, release })
    mocks.lookupActiveProjectPass.mockResolvedValue({ ok: true, active: true })
    mocks.validateCostCeiling
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, status: 402, reason: 'insufficient_balance' })

    const response = await POST(request({
      projectId: project.projectId,
      capability: 'contextual_ai',
      messages: [{ role: 'user', content: 'Bok' }],
    }))

    expect(response.status).toBe(402)
    expect(release).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toBeDefined()
  })
})
