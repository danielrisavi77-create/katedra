// ============================================================
// KATEDRA — streaming proxy prema Anthropic API-ju
// Ključ živi SAMO ovdje (env). Klijent šalje postojeću Supabase
// sesiju (cookie) — ista app, isti origin.
//
// Audit 4: primarni gate je Project Pass ENTITLEMENT (postoji li aktivan
// academic-pass/academic-pass-plus za ovaj projekt), ne wallet balance.
// Wallet ostaje SEKUNDARNI interni spend-guard/hard cap — i jedini gate za
// korisnike bez Passa (mali free-tier starter budžet, v. app/api/webhook i
// Faza 4 plana). Tok: auth → entitlement/wallet provjera → stream → naplata
// (input + 5×output, model-aware multiplier).
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIN_BALANCE } from '@/lib/limits'
import { ensureFreeStarterGrant } from '@/lib/katedra-free-starter'
import { resolveCapability } from '@/lib/academic-suite/process-facts'
import { loadProcessFactsFromDisk } from '@/lib/academic-suite/process-facts.server'
import { lookupActiveProjectPass } from '@/lib/academic-suite/repositories/entitlements'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { createAnthropicUsageParser } from '@/lib/ai/anthropic-sse'
import { buildBillingConsumeParams, buildBillingPendingParams, resolveBillingOutcome } from '@/lib/ai/billing-contract'
import { authorizeProjectAiRequest } from '@/lib/ai/project-access'
import { isAdminOverrideUser } from '@/lib/auth/admin-access'
import { isDistributedRateLimitConfigured, releaseRateLimitReservation, reserveDistributedRequest, reserveUserRequest } from '@/lib/ai/rate-limit'
import { AI_COST_LIMITS, AI_MODEL_COST_MULTIPLIERS, estimateChatCharge, maxAffordableOutputTokens, validateCostCeiling } from '@/lib/ai/cost-policy'
import { countChatAttachmentChars, countChatInputChars, validateChatRequest } from '@/lib/chat/validation'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'
import { logAiEvent, safeErrorCode } from '@/lib/observability/ai-events'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const MODELS = new Set(['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'])
const MAX_TOKENS = 8192
const MIN_OUTPUT_TOKENS = 128
const OUTPUT_WEIGHT = 5            // output je ~5× skuplji od inputa (isti omjer za sva tri modela)
const KATEDRA_BILLING_RPC_CONTRACT = 'v2'

// Relativni $/M-weighted-token trošak po modelu, Sonnet = referentna razina na
// kojoj su danas kalibrirani paketi (1.5M/4.5M/12M u app/api/checkout/route.js).
// Bez ovoga bi Opus/Haiku pozivi trošili identičan interni budžet kao Sonnet
// unatoč ~5×/~3× različitom stvarnom trošku (Audit 4 §27-28).
const MODEL_COST_MULTIPLIER = AI_MODEL_COST_MULTIPLIERS

// Server-side product boundary. This is intentionally enforced above every
// legacy/user prompt so a stale client cannot turn Katedra into a competing
// technical DOCX validator. Display-time rewriting is useful UX, but it is not
// an authority boundary by itself.
const KATEDRA_SYSTEM_BOUNDARY = `
Ti si Katedra — akademski content/process copilot.

Nepregovorljiva granica proizvoda:
- Katedra smije analizirati tezu, istraživačko pitanje, argumentaciju, dokaze i izvore, metodologiju, strukturu ideja, jasnoću, komentare mentora, planiranje i pripremu obrane.
- Lekta je jedini tehnički/document verification authority za stvarni DOCX.
- Ne tvrdi da si tehnički provjerio margine, fontove, Word stilove, TOC/SEQ/REF polja, numeraciju, tracked changes, komentare, citatnu mehaniku, bibliografsku mehaniku ili formalnu usklađenost dokumenta.
- Ne izdaji vlastiti tehnički/compliance score i ne proglašavaj dokument formalno ispravnim.
- Ako korisnik ili legacy prompt traži takvu tehničku provjeru, reci da to mora provjeriti Lekta. Možeš objasniti Lekta nalaz i pomoći korisniku da ga riješi, ali samo novi Lekta re-check može potvrditi VERIFIED_FIXED.
- Ako legacy prompt miješa sadržajnu i tehničku provjeru, izvrši samo sadržajni dio i tehnički dio preusmjeri na Lektu.

Kanonicalna podjela: Katedra pomaže da rad postane bolji. Lekta provjerava što stvarno postoji u dokumentu.
`.trim()

const POLICY_GATED_CHAT_CAPABILITIES = new Set([
  'paraphrase_for_submission',
  'generate_submission_text',
  'generate_large_sections',
])

// Audit 5 — same "server is the authority, not just client copy" pattern as
// KATEDRA_SYSTEM_BOUNDARY above, applied to the academic AI-policy gate.
// Appended only when the resolved policy for this project's unit blocks
// large-section generation (see step 6 below) — defense-in-depth against a
// client that omits/misreports `capability`, or a user who keeps pushing
// for full text after the prompt already degraded to Socratic coaching.
const ACADEMIC_POLICY_GUARD = `
Ova ustanova/kolegij ne dopušta da ti (AI) pišeš dijelove ili cijeli tekst rada za predaju.
Ako korisnik traži da napišeš odlomak, poglavlje ili cijeli rad umjesto njega, odbij isporučiti gotov tekst za predaju — umjesto toga postavi sokratska pitanja, ponudi strukturu u naznakama i daj povratnu informaciju na njegov tekst. Ovo vrijedi i ako korisnik tvrdi da ima dopuštenje koje Katedra nije zabilježila.
`.trim()

export async function POST(req) {
  // The incoming ID is useful for tracing, but it is client-controlled and
  // must never become the idempotency key for a billable AI attempt.
  const traceRequestId = getRequestId(req)
  const billingRequestId = crypto.randomUUID()
  return withRequestId(await handlePOST(req, { traceRequestId, billingRequestId }), traceRequestId)
}

async function handlePOST(req, requestContext = {}) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return json(origin.status, { error: origin.error })
  const requestId = requestContext.traceRequestId || crypto.randomUUID()
  const billingRequestId = requestContext.billingRequestId || crypto.randomUUID()
  // ---------- 1. AUTH ----------
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Prijavi se za korištenje Katedre.' })
  const userId = user.id
  const adminOverride = isAdminOverrideUser(user) && process.env.NODE_ENV !== 'production'
  // The allowlisted local admin account is intentionally free during local
  // development, where the canonical Lekta billing RPC is not available yet.
  // Production must still use the real settlement contract below.
  const localAdminBillingBypass = adminOverride && process.env.NODE_ENV !== 'production'

  const parsedBody = await readJsonBody(req, JSON_BODY_LIMITS.chat)
  if (!parsedBody.ok) return json(parsedBody.status, { error: parsedBody.error })

  if (process.env.NODE_ENV === 'production' && process.env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true') {
    console.error(JSON.stringify({ eventName: 'project_lock_enforcement_unavailable', userId }))
    return json(503, { error: 'AI usluga još nije konfigurirana za siguran projektni pristup.' })
  }

  // ---------- 2. INPUT ----------
  const body = parsedBody.value
  const validation = validateChatRequest(body)
  if (!validation.ok) return json(validation.status, { error: validation.error })
  const messages = body.messages
  const model = MODELS.has(body?.model) ? body.model : 'claude-sonnet-5'
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  if (!projectId) return json(400, { error: 'Nedostaje projekt.' })

  let db
  try {
    db = createAdminClient()
  } catch (error) {
    console.error(JSON.stringify({
      eventName: 'chat_admin_client_unavailable',
      requestId,
      userId,
      projectId,
      errorCode: safeErrorCode(error),
    }))
    return json(503, { error: 'AI pristup trenutno nije konfiguriran za siguran rad.' })
  }

  const projectResult = await resolveOwnedProjectResult(db, { userId, projectId })
  if ('error' in projectResult) {
    logAiEvent({ eventName: 'chat_project_lookup_failed', requestId, userId, projectId, errorCode: safeErrorCode(projectResult.error), outcome: 'failed' }, 'error')
    return json(503, { error: 'Projekt trenutačno nije moguće provjeriti.' })
  }
  const project = projectResult.value
  if (!project) return json(404, { error: 'Projekt nije pronađen za ovaj račun.' })
  const capability = typeof body?.capability === 'string' ? body.capability.trim() : ''
  const paidCapability = projectCapabilityForChat(capability)
  if (process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true' && !paidCapability) {
    return json(400, { error: 'Nedostaje ili nije podržana AI mogućnost.' })
  }
  if (process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true' && paidCapability) {
    const { resolveProjectCapability } = await import('@/lib/product/server-capabilities')
    const decision = await resolveProjectCapability(supabase, { userId, projectId: project?.projectId || projectId, capability: paidCapability })
    if (!decision.allowed) {
      const status = decision.code === 'pass_required' ? 402 : decision.code === 'policy_unverified' ? 403 : decision.code === 'project_not_owned' ? 404 : 503
      return json(status, { error: decision.code === 'policy_unverified' ? 'Institucijska pravila za ovu AI mogućnost još nisu verificirana.' : 'Ova AI mogućnost nije otključana za ovaj projekt.', reason: decision.code })
    }
  }
  const useDistributedRateLimit = isDistributedRateLimitConfigured()
  if (process.env.NODE_ENV === 'production' && !useDistributedRateLimit) {
    console.error(JSON.stringify({ eventName: 'rate_limit_store_unavailable', userId }))
    return json(503, { error: 'AI usluga još nije konfigurirana za sigurno ograničavanje zahtjeva.' })
  }

  const inputChars = countChatInputChars(messages)
  const attachmentChars = countChatAttachmentChars(messages)
  const inputPolicy = validateCostCeiling({
    balance: Number.MAX_SAFE_INTEGER,
    minimumBalance: 0,
    estimatedCharge: 1,
    dailyUsed: 0,
    dailyCeiling: Number.MAX_SAFE_INTEGER,
    activeStreams: 0,
    inputChars,
    attachmentChars,
  })
  if (!inputPolicy.ok) return json(inputPolicy.status, { error: 'Zahtjev je prevelik.', reason: inputPolicy.reason })

  // Reserve the full permitted output before wallet/starter side effects.
  // The later wallet limit can only reduce provider output. Reserving a
  // smaller baseline would understate the atomic cross-instance daily cap
  // and the pending-reconciliation estimate when usage is unavailable.
  const reservationEstimatedCharge = estimateChatCharge({
    inputChars,
    model,
    attachmentChars,
    maxOutputTokens: MAX_TOKENS,
    outputWeight: OUTPUT_WEIGHT,
  })
  const billingContractEnabled = process.env.KATEDRA_BILLING_RPC_CONTRACT === KATEDRA_BILLING_RPC_CONTRACT
  if (process.env.NODE_ENV === 'production' && !billingContractEnabled) {
    return json(503, { error: 'Naplate AI usluga još nije konfigurirana za siguran rad.' })
  }
  const reservation = useDistributedRateLimit
    ? await reserveDistributedRequest(db, { userId, requestId: billingRequestId, estimatedCharge: reservationEstimatedCharge })
    : reserveUserRequest(userId)
  if (!reservation.allowed) {
    if (reservation.reason === 'unavailable') {
      return json(503, { error: 'Ograničavanje zahtjeva trenutno nije dostupno.' })
    }
    return json(429, {
      error: reservation.reason === 'concurrency'
        ? 'Već obrađujem dva odgovora — pričekaj da jedan završi.'
        : 'Previše zahtjeva — pričekaj minutu.',
    })
  }
  const releaseReservation = async () => {
    await releaseRateLimitReservation(reservation, (error, attempt) => {
      logAiEvent({ eventName: 'rate_limit_release_failed', attempt, requestId, billingRequestId, userId, projectId: project.projectId || projectId, errorCode: safeErrorCode(error), outcome: 'pending_reconciliation' }, 'error')
    })
  }

  // ---------- 4. PASS ENTITLEMENT (primarni gate) ----------
  const canonicalProjectId = project.projectId
  let hasPass = false
  if (!adminOverride) {
    const passLookup = await lookupActiveProjectPass(db, { userId, projectId: canonicalProjectId })
    if (!passLookup.ok) {
      logAiEvent({ eventName: 'project_pass_lookup_unavailable', requestId, userId, projectId: canonicalProjectId, errorCode: safeErrorCode(passLookup.error), outcome: 'failed' }, 'error')
      await releaseReservation()
      return json(503, { error: 'Status Passa trenutno nije moguće provjeriti.' })
    }
    hasPass = passLookup.active
  }
  let projectAccess = null

  // A user-global wallet cannot authorize a no-Pass project. Once the v2
  // billing contract is enabled, the Lekta-side project access RPC becomes
  // the authority for the project-scoped starter grant and remaining budget.
  if (!adminOverride && !hasPass && billingContractEnabled) {
    projectAccess = await authorizeProjectAiRequest(db, {
      userId,
      projectId: canonicalProjectId,
      hasPass,
    })
    if (!projectAccess.allowed) {
      await releaseReservation()
      if (projectAccess.reason === 'unavailable') {
        return json(503, { error: 'Projektni AI pristup trenutno nije moguće provjeriti.' })
      }
      return json(402, {
        error: 'Aktiviraj Pass za ovaj projekt.',
        reason: 'no-pass',
        balance: projectAccess.balance ?? 0,
      })
    }
    if (!Number.isFinite(projectAccess.balance)) {
      console.error(JSON.stringify({
        eventName: 'project_ai_balance_unavailable',
        requestId,
        userId,
        projectId: canonicalProjectId,
      }))
      await releaseReservation()
      return json(503, { error: 'Projektni wallet trenutno nije moguće provjeriti.' })
    }
  }

  // ---------- 5. WALLET — interni spend-guard / free-tier starter budžet ----------
  // Isti helper kao /api/balance (v. lib/katedra-free-starter.js) — mora ostati
  // identičan mehanizam na oba mjesta, inače se proaktivna provjera i stvarni
  // gate opet mogu razići (v. napomena u balance/route.js).
  if (!hasPass && !billingContractEnabled) {
    await ensureFreeStarterGrant(db, userId, canonicalProjectId)
  }

  // In billing v2, an allowed no-Pass project is authorized by the
  // project-scoped RPC above. Do not make that path depend on the legacy
  // user-global wallet row; the RPC's balance is the canonical starter grant
  // for this project. Pass users and legacy development mode still use the
  // global wallet as the secondary spend guard.
  let wallet = null
  let walletError = null
  if (!adminOverride && !projectAccess?.allowed) {
    ({ data: wallet, error: walletError } = await db
      .from('katedra_wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle())
  }
  if (walletError) {
    logAiEvent({ eventName: 'wallet_lookup_failed', requestId, userId, projectId: canonicalProjectId, errorCode: safeErrorCode(walletError), outcome: 'failed' }, 'error')
    await releaseReservation()
    return json(503, { error: 'Stanje walleta trenutno nije dostupno.' })
  }
  const balance = adminOverride ? Number.MAX_SAFE_INTEGER : projectAccess?.balance ?? wallet?.balance ?? 0
  const requestMaxOutputTokens = maxAffordableOutputTokens({
    balance,
    minimumBalance: MIN_BALANCE,
    inputChars,
    attachmentChars,
    model,
    outputWeight: OUTPUT_WEIGHT,
    maxOutputTokens: MAX_TOKENS,
  })
  const estimatedCharge = estimateChatCharge({
    inputChars,
    attachmentChars,
    model,
    maxOutputTokens: requestMaxOutputTokens,
    outputWeight: OUTPUT_WEIGHT,
  })

  // The reservation RPC enforces the cross-instance daily ceiling atomically.
  // This local check covers the per-request wallet fit and bounded input
  // estimate; it deliberately does not pretend that dailyUsed=0 is a live
  // usage total.
  const costPolicy = validateCostCeiling({
    balance,
    minimumBalance: MIN_BALANCE,
    estimatedCharge,
    dailyUsed: 0,
    dailyCeiling: AI_COST_LIMITS.maxDailyCharge,
    activeStreams: 0,
    inputChars,
    attachmentChars,
  })
  if (!adminOverride && (!costPolicy.ok || requestMaxOutputTokens < MIN_OUTPUT_TOKENS)) {
    await releaseReservation()
    const rejectionStatus = requestMaxOutputTokens < MIN_OUTPUT_TOKENS ? 402 : costPolicy.status
    return json(rejectionStatus, {
      error: requestMaxOutputTokens < MIN_OUTPUT_TOKENS || costPolicy.reason === 'insufficient_balance'
        ? 'Ovaj zahtjev ne stane u preostali AI budžet projekta.'
        : costPolicy.reason === 'daily_ceiling'
          ? 'Dosegnut je dnevni AI limit.'
          : costPolicy.reason === 'concurrency'
            ? 'Već obrađujem dva odgovora — pričekaj da jedan završi.'
            : 'Zahtjev je prevelik.',
      reason: costPolicy.reason,
      balance,
    })
  }

  if (!adminOverride && balance < MIN_BALANCE) {
    if (!hasPass) {
      // Bez Passa i bez (preostalog) free-tier budžeta — usmjeri na kupnju
      // Passa za OVAJ projekt, ne na generičko "dokupi kredite".
      await releaseReservation()
      return json(402, { error: 'Aktiviraj Pass za ovaj projekt.', reason: 'no-pass', balance })
    }
    // Korisnik ima aktivan Pass, ali je dosegnuo interni safety cap. Ne nudimo
    // automatski "kupi još" — Audit 4 §21-22: prvih mjeseci ovo ide na ručni
    // pregled, ne na tihi upsell.
      console.log(JSON.stringify({
        eventName: 'internal_spend_cap_reached', occurredAt: new Date().toISOString(),
        userId, projectId: canonicalProjectId, balance,
      }))
    await releaseReservation()
    return json(402, { error: 'Dosegnut je interni sigurnosni limit za ovaj projekt. Javi se podršci.', reason: 'cap-reached', balance })
  }

  // ---------- 6. ACADEMIC AI-POLICY CAPABILITY GATE (Audit 5) ----------
  // unitId comes from the project's OWN row in the database, never from the
  // client body — a stale/modified client cannot claim a friendlier
  // faculty than the one actually saved for this project. Mirrors the
  // KATEDRA_SYSTEM_BOUNDARY pattern above (server authority, not just
  // client-side prompt shaping — server-side capability remains authoritative.
  let policyBlocked = false
  if (projectId && !adminOverride) {
    let row = null
    try {
      const byProject = await db
        .from('katedra_projects')
        .select('unit_id, gen')
        .eq('user_id', userId)
        .eq('project_id', canonicalProjectId)
        .maybeSingle()
      row = byProject.data
      if (!row) {
        const byGuest = await db
          .from('katedra_projects')
          .select('unit_id, gen')
          .eq('user_id', userId)
          .eq('guest_project_id', project.guestProjectId)
          .maybeSingle()
        row = byGuest.data
      }
    } catch {
      row = null // fail closed — same as an unmatched/unknown project below
    }
    const unitId = row?.unit_id || ''
    const facts = await loadProcessFactsFromDisk()
    const policyCapability = POLICY_GATED_CHAT_CAPABILITIES.has(capability) ? capability : null
    if (policyCapability) {
      const resolved = resolveCapability(facts, unitId, policyCapability)
      const ack = row?.gen?.aiAck?.[policyCapability]
      const mentorUnlocked = Boolean(
        resolved.condition?.mentorApproval && ack?.factId && ack.factId === resolved.sourceFactId,
      )
      policyBlocked = resolved.effective === 'blocked' && !mentorUnlocked
      if (policyBlocked) {
        await releaseReservation()
        return json(403, {
          error: 'Tvoja odobrena AI razina ne dopušta generiranje ili preoblikovanje teksta za predaju — Katedra ti umjesto toga može pomoći pitanjima i strukturom.',
          reason: 'ACADEMIC_POLICY_BLOCK',
          capability: policyCapability,
          stance: resolved.stance,
        })
      }
    }
  }

  // A legacy RPC cannot prove idempotent settlement. Fail closed before
  // calling the provider until the Lekta-side contract is deployed.
  if (!billingContractEnabled && !localAdminBillingBypass) {
    console.error(JSON.stringify({
      eventName: 'billing_contract_unavailable', requestId, billingRequestId, userId, projectId: canonicalProjectId,
    }))
    await releaseReservation()
    return json(503, { error: 'Naplate AI usluga još nije konfigurirana za siguran rad.' })
  }

  // ---------- 7. ANTHROPIC STREAM ----------
  const upstreamController = new AbortController()
  const upstreamTimeout = setTimeout(() => upstreamController.abort(), 90_000)
  let upstream
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: requestMaxOutputTokens,
        stream: true,
        system: policyBlocked ? KATEDRA_SYSTEM_BOUNDARY + '\n\n' + ACADEMIC_POLICY_GUARD : KATEDRA_SYSTEM_BOUNDARY,
        messages,
      }),
      signal: upstreamController.signal,
    })
  } catch {
    clearTimeout(upstreamTimeout)
    await releaseReservation()
    return json(502, { error: 'AI servis nije dostupan.' })
  }
  if (!upstream.ok || !upstream.body) {
    const providerStatus = upstream.status
    console.error(JSON.stringify({ eventName: 'anthropic_upstream_error', requestId, status: providerStatus }))
    clearTimeout(upstreamTimeout)
    await releaseReservation()
    return json(502, { error: 'AI servis nije dostupan.' })
  }

  // ---------- 8. PIPE + brojanje tokena + naplata na kraju (i kod prekida) ----------
  const usageParser = createAnthropicUsageParser()
  let finalizationPromise = null

  const consume = async () => {
    if (finalizationPromise) return finalizationPromise
    finalizationPromise = (async () => {
      if (localAdminBillingBypass) {
        console.log(JSON.stringify({
          eventName: 'billing_local_admin_bypass', requestId, billingRequestId, userId, projectId: canonicalProjectId,
        }))
        return
      }
      const { inputTokens, outputTokens } = usageParser.usage()
      if (inputTokens <= 0 && outputTokens <= 0) {
        logAiEvent({
          eventName: 'billing_usage_unavailable', requestId, billingRequestId, userId, projectId: canonicalProjectId,
          model, inputTokens: 0, outputTokens: 0, billingState: 'pending_reconciliation', outcome: 'pending_reconciliation',
        }, 'error')
        let pending
        try {
          pending = await db.rpc('katedra_mark_pending', buildBillingPendingParams({
            requestId: billingRequestId,
            userId,
            projectId: canonicalProjectId,
            model,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCharge: reservationEstimatedCharge,
          }))
        } catch (pendingError) {
          pending = { error: pendingError }
        }
        if (pending?.error || pending?.data?.status !== 'pending_reconciliation') {
          logAiEvent({
            eventName: 'billing_pending_marker_failed', requestId, billingRequestId, userId, projectId: canonicalProjectId,
            errorCode: pending?.error ? safeErrorCode(pending.error) : 'pending_marker_rejected', outcome: 'pending_reconciliation',
          }, 'error')
        }
        throw new Error('Billing usage unavailable')
      }
      const weighted = inputTokens + OUTPUT_WEIGHT * outputTokens
      const charged = adminOverride ? 0 : Math.round(weighted * (MODEL_COST_MULTIPLIER[model] ?? 1))
      let data
      let error
      try {
        ({ data, error } = await db.rpc('katedra_consume', buildBillingConsumeParams({
          requestId: billingRequestId,
          userId,
          projectId: canonicalProjectId,
          charged,
          model,
          inputTokens,
          outputTokens,
        })))
      } catch (rpcError) {
        error = rpcError
      }
      if (error) {
        let pending
        try {
          pending = await db.rpc('katedra_mark_pending', buildBillingPendingParams({
            requestId: billingRequestId,
            userId,
            projectId: canonicalProjectId,
            charged,
            model,
            inputTokens,
            outputTokens,
          }))
        } catch (pendingError) {
          pending = { error: pendingError }
        }
        logAiEvent({
          eventName: 'billing_pending_reconciliation', requestId, billingRequestId, userId, projectId: canonicalProjectId,
          model, inputTokens, outputTokens, charged, billingState: 'pending_reconciliation', errorCode: safeErrorCode(error), outcome: 'pending_reconciliation',
        }, 'error')
        throw new Error('Billing finalization failed')
      }
      const outcome = resolveBillingOutcome({
        provider: 'completed',
        usage: { inputTokens, outputTokens },
        rpc: data?.status === 'already_settled' ? 'already_settled' : data?.status === 'settled' ? 'settled' : 'unknown',
      })
      if (outcome.state !== 'settled') {
        let pending
        try {
          pending = await db.rpc('katedra_mark_pending', buildBillingPendingParams({
            requestId: billingRequestId,
            userId,
            projectId: canonicalProjectId,
            charged,
            model,
            inputTokens,
            outputTokens,
          }))
        } catch (pendingError) {
          pending = { error: pendingError }
        }
        logAiEvent({
          eventName: 'billing_pending_reconciliation', requestId, billingRequestId, userId, projectId: canonicalProjectId,
          model, inputTokens, outputTokens, charged, billingState: 'pending_reconciliation', reason: outcome.reason, errorCode: pending?.error ? safeErrorCode(pending.error) : undefined, outcome: 'pending_reconciliation',
        }, 'error')
        throw new Error('Billing finalization pending reconciliation')
      }
      logAiEvent({
        eventName: 'billing_settled', requestId, billingRequestId, userId, projectId: canonicalProjectId,
        model, inputTokens, outputTokens, charged, billingState: 'settled', outcome: 'settled',
      })
    })().finally(async () => {
      clearTimeout(upstreamTimeout)
      await releaseReservation()
    })
    return finalizationPromise
  }

  const reader = upstream.body.getReader()
  const counted = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          usageParser.push(value)
          controller.enqueue(value)
        }
        usageParser.finish()
        await consume()
        controller.close()
       } catch (error) {
         usageParser.finish()
        await consume().catch((billingError) => {
          logAiEvent({
            eventName: 'billing_finalization_failed', requestId, billingRequestId, userId, projectId: canonicalProjectId,
            errorCode: safeErrorCode(billingError), outcome: 'pending_reconciliation',
          }, 'error')
        })
         try { controller.error(error) } catch { /* client already cancelled */ }
      }
    },
    async cancel(reason) {
       upstreamController.abort()
       usageParser.finish()
      await consume().catch((billingError) => {
        logAiEvent({
          eventName: 'billing_finalization_failed', requestId, billingRequestId, userId, projectId: canonicalProjectId,
          errorCode: safeErrorCode(billingError), outcome: 'pending_reconciliation',
        }, 'error')
      })
      await reader.cancel(reason).catch(() => {})
    }, // klijent prekinuo stream — naplata svejedno prođe
  })

  return new Response(counted, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-katedra-balance-before': adminOverride ? 'unlimited' : String(balance),
      // Klijent nikad ne šalje model (v. MODELS default gore) — ovo mu javlja
      // koji je STVARNO odgovorio, za lokalni AI ledger, umjesto da
      // klijent pogađa/pretpostavlja vrijednost koju server odluči promijeniti.
      'x-katedra-model': model,
      'x-katedra-request-id': requestId,
    },
  })
}

function projectCapabilityForChat(capability) {
  if (capability === 'generate_large_sections' || capability === 'generate_submission_text') return 'full_generation'
  if (capability === 'paraphrase_for_submission') return 'section_writing'
  if (capability === 'contextual_ai') return 'contextual_ai'
  if (capability === 'methodology') return 'methodology'
  if (capability === 'source_suggestions') return 'source_suggestions'
  return null
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
