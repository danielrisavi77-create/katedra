// ============================================================
// KATEDRA — server-side sync cijelog stanja čarobnjaka
//
// Shared-foundation compatibility:
// - legacy Katedra clients may keep sending guestProjectId + workType s/z/d
// - new clients may send projectId + workTypeCanonical
// - server persists BOTH legacy and canonical fields during migration
//
// Audit 3 P0 §1: raw document content never enters shared state. The server
// always applies the allowlists below, even when a legacy client sends
// fullSyncConsent=true. The client flag is therefore not an authority
// boundary; the server is the authority and the privacy rule stays
// fail-closed without a new database migration.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import {
  ACADEMIC_SUITE_CONTRACT_VERSION,
  fromLegacyKatedraWorkType,
  isAcademicWorkType,
} from '@/lib/academic-suite/contracts'
import { GEN_SERVER_SAFE_KEYS, LOG_SERVER_SAFE_KEYS } from '@/lib/academic-suite/katedra-state-privacy'
import { sanitizeLektaIssues } from '@/lib/academic-suite/state-issue-projection'
import { loadOwnedWorkflow, WorkflowPersistenceError } from '@/lib/academic-suite/workflow/repository'
import { resolveWorkflowForLegacySelection } from '@/lib/academic-suite/workflow/resolver'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { readProjectLock, validateLockedProjectMutation } from '../../../lib/academic-suite/project-lock'
import { stripManuscriptFromStatePayload } from '@/lib/manuscript/privacy'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'
import { JSON_BODY_LIMITS, readJsonBody } from '@/lib/http/json-body.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { validateSameOriginRequest } from '@/lib/http/request-origin.js'

const COLUMNS =
  'id, project_id, contract_version, unit_id, profile_id, work_type, work_type_canonical, ' +
  'topic, deadline, ruleset_version, lekta_score, lekta_checked_at, lekta_issues, ' +
  'lekta_fixed_total, checks, gen, hist, log, guest_project_id, updated_at'

function projectLocksEnabled() {
  return process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true'
}

function projectLockUnavailableResponse() {
  return privateJson(
    { error: 'Server-side zaklju\u010davanje projekta trenutno nije aktivno.' },
    { status: 503 },
  )
}

const LOCKED_PROJECT_MUTATION_ERROR = 'Locked Katedra project identity is immutable'
const LOCKED_PROJECT_MUTATION_MESSAGE = 'Tema je zaključana nakon naplate. Za novu temu potreban je novi projekt i Pass.'

function rowToCamel(row) {
  if (!row) return {}
  return {
    id: row.id,
    projectId: row.project_id,
    contractVersion: row.contract_version,
    unitId: sanitizeStateText(row.unit_id, 200) ?? null,
    profileId: sanitizeStateText(row.profile_id, 200) ?? null,
    workType: row.work_type, // legacy UI compatibility
    workTypeCanonical: row.work_type_canonical,
    topic: sanitizeStateText(row.topic, 500) ?? null,
    deadline: row.deadline,
    rulesetVersion: sanitizeStateText(row.ruleset_version, 120) ?? null,
    lektaScore: row.lekta_score,
    lektaCheckedAt: row.lekta_checked_at,
    lektaIssues: sanitizeLektaIssues(row.lekta_issues),
    lektaFixedTotal: row.lekta_fixed_total,
    checks: sanitizeChecks(row.checks),
    gen: sanitizeGen(row.gen),
    hist: sanitizeHist(row.hist),
    log: sanitizeLog(row.log),
    guestProjectId: row.guest_project_id,
    updatedAt: row.updated_at,
  }
}

// Untyped/text/JSON fields can be copied after ownership checks. Typed database
// fields are normalized separately below so legacy UI empty strings never reach
// Postgres date/timestamptz/integer columns.
const WRITABLE_FIELDS = {
  unitId: 'unit_id',
  profileId: 'profile_id',
  topic: 'topic',
  rulesetVersion: 'ruleset_version',
  lektaIssues: 'lekta_issues',
  checks: 'checks',
  gen: 'gen',
  hist: 'hist',
  log: 'log',
}

// Audit 5 — server-side backstop, symmetric with the client-side filtering
// in the legacy wizard payload path.
// A stale/un-migrated client would otherwise keep writing full free-text
// academic content (mentor instructions, attached-material descriptions,
// the actual generated prompt/response text) forever — this repeats the
// SAME allowlist here so the write path is safe even when the client
// "forgets" to filter, not only when it remembers to.
function sanitizeGen(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const safe = {}
  for (const key of GEN_SERVER_SAFE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue
    const value = raw[key]
    if (GEN_BOOLEAN_KEYS.has(key)) {
      if (typeof value === 'boolean') safe[key] = value
      continue
    }
    if (GEN_INTEGER_KEYS.has(key)) {
      const number = boundedInteger(value, 0, 10_000_000)
      if (number !== undefined) safe[key] = number
      continue
    }
    if (key === 'aiAck') {
      const acknowledgements = sanitizeAiAcknowledgements(value)
      if (Object.keys(acknowledgements).length) safe[key] = acknowledgements
      continue
    }
    const text = sanitizeShortText(value, GEN_TEXT_LIMITS[key] || 200)
    if (text !== undefined && (!GEN_TEXT_PATTERNS[key] || GEN_TEXT_PATTERNS[key].test(text))) safe[key] = text
  }
  return safe
}
function sanitizeHist(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 250).flatMap((entry) => {
    const timestamp = boundedInteger(entry?.t, 0, Number.MAX_SAFE_INTEGER)
    if (timestamp === undefined) return []
    const safe = { t: timestamp }
    const mode = sanitizeShortText(entry?.mode, 80)
    const tip = sanitizeShortText(entry?.tip, 80)
    if (mode !== undefined) safe.mode = mode
    if (tip !== undefined) safe.tip = tip
    return [safe]
  })
}
function sanitizeLog(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 250).flatMap((entry) => {
    const timestamp = boundedInteger(entry?.t, 0, Number.MAX_SAFE_INTEGER)
    if (timestamp === undefined) return []
    const safe = { t: timestamp }
    for (const key of LOG_SERVER_SAFE_KEYS) {
      if (!entry || !Object.prototype.hasOwnProperty.call(entry, key)) continue
      if (LOG_BOOLEAN_KEYS.has(key)) {
        if (typeof entry[key] === 'boolean') safe[key] = entry[key]
        continue
      }
      if (key === 'files') {
        if (Array.isArray(entry.files)) {
          const files = entry.files.slice(0, 20).flatMap((file) => {
            const name = sanitizeShortText(file, 200)
            return name === undefined ? [] : [name]
          })
          if (files.length) safe.files = files
        }
        continue
      }
      if (key === 'lekta_result') {
        const result = sanitizeLektaResult(entry.lekta_result)
        if (result) safe.lekta_result = result
        continue
      }
      const value = sanitizeShortText(entry[key], 120)
      if (value !== undefined) safe[key] = value
    }
    return [safe]
  })
}

const GEN_BOOLEAN_KEYS = new Set(['f_brutal', 'a_gradja', 'a_checkpoint', 'u_skills', 'a_learn'])
const GEN_INTEGER_KEYS = new Set(['wc_total'])
const GEN_TEXT_LIMITS = {
  f_fakultet: 200,
  f_kolegij: 200,
  f_opseg: 120,
  f_izvori: 40,
  f_stil: 200,
  f_rok: 40,
  f_radfile: 200,
  f_trajanje: 40,
  f_datumobr: 40,
  wc_unit: 40,
}
const GEN_TEXT_PATTERNS = {
  f_opseg: /^[\d.,\s]*(?:[-–][\d.,\s]*)?(?:riječi|stranica|pages?|words?)?$/iu,
  f_izvori: /^(?:min\.\s*)?\d{1,4}$/iu,
  f_rok: /^\d{4}-\d{2}-\d{2}$/u,
  f_datumobr: /^\d{4}-\d{2}-\d{2}$/u,
  f_trajanje: /^\d{1,3}(?:\s*(?:min|minute|minuta))?$/iu,
}

function sanitizeChecks(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const safe = {}
  for (const [key, value] of Object.entries(raw).slice(0, 500)) {
    const safeKey = sanitizeShortText(key, 160)
    if (safeKey !== undefined && typeof value === 'boolean') safe[safeKey] = value
  }
  return safe
}
const LOG_BOOLEAN_KEYS = new Set(['done', 'skip', 'open', 'aiGenerated', 'reviewed'])
const AI_ACK_KEYS = new Set([
  'contextual_ai', 'section_writing', 'full_generation', 'generate_large_sections',
  'source_suggestions', 'web_research', 'mentor_review', 'methodology',
  'defense_simulator', 'autonomous_run',
])

function sanitizeAiAcknowledgements(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const safe = {}
  for (const [capability, value] of Object.entries(raw)) {
    if (!AI_ACK_KEYS.has(capability) || value == null || typeof value !== 'object' || Array.isArray(value)) continue
    const factId = sanitizeShortText(value.factId, 120)
    const factVerifiedDate = sanitizeShortText(value.factVerifiedDate, 40)
    const ackedAt = boundedInteger(value.ackedAt, 0, Number.MAX_SAFE_INTEGER)
    if (!factId || ackedAt === undefined) continue
    safe[capability] = { factId, ...(factVerifiedDate ? { factVerifiedDate } : {}), ackedAt }
  }
  return safe
}

function sanitizeLektaResult(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const result = {}
  const score = boundedInteger(raw.score, 0, 100)
  const issueCount = boundedInteger(raw.issueCount, 0, 100_000)
  if (score !== undefined) result.score = score
  if (issueCount !== undefined) result.issueCount = issueCount
  if (Array.isArray(raw.findingIds)) {
    const findingIds = raw.findingIds.slice(0, 250).flatMap((id) => {
      const value = sanitizeShortText(id, 120)
      return value === undefined ? [] : [value]
    })
    if (findingIds.length) result.findingIds = findingIds
  }
  return Object.keys(result).length ? result : null
}

function sanitizeShortText(value, maxLength) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined
  return normalized
}

function sanitizeStateText(value, maxLength) {
  if (value === null || value === '') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined
  return normalized
}

function sanitizeUnitId(value) {
  return sanitizeStateText(value, 200)
}

function sanitizeProfileId(value) {
  return sanitizeStateText(value, 200)
}

function sanitizeTopic(value) {
  return sanitizeStateText(value, 500)
}

function sanitizeRulesetVersion(value) {
  return sanitizeStateText(value, 120)
}

function boundedInteger(value, min, max) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/u.test(value.trim()) ? Number(value) : NaN
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : undefined
}

function cleanOpaqueId(value) {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  // Opaque IDs are not parsed for semantics, but reject obviously unsafe payloads.
  if (!id || id.length > 200) return ''
  return id
}

function cleanCanonicalProjectId(value) {
  const id = cleanOpaqueId(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return ''
  return id
}

function canonicalWorkType(body) {
  if (isAcademicWorkType(body?.workTypeCanonical)) return body.workTypeCanonical
  if (body?.workType === 's' || body?.workType === 'z' || body?.workType === 'd') {
    return fromLegacyKatedraWorkType(body.workType)
  }
  return null
}

function normalizeDeadline(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return undefined
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined
  return value
}

function normalizeNullableInteger(value, min, max = Number.MAX_SAFE_INTEGER) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return undefined
  return n
}

export async function GET(req) {
  return withRequestId(await handleGET(req), getRequestId(req))
}

async function handleGET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  if (process.env.NODE_ENV === 'production' && !projectLocksEnabled()) return projectLockUnavailableResponse()

  const projectId = cleanOpaqueId(new URL(req.url).searchParams.get('projectId'))
  if (!projectId) return privateJson({ error: 'Nedostaje ID projekta.' }, { status: 400 })

  const projectLookup = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if (!projectLookup.ok) return privateJson({ error: 'Provjera projekta nije uspjela.' }, { status: 503 })
  const project = projectLookup.value
  if (!project) return privateJson({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .eq('project_id', project.projectId)
    .maybeSingle()

  if (error) return privateJson({ error: 'Učitavanje nije uspjelo.' }, { status: 500 })
  if (!row) return privateJson({ error: 'Stanje projekta nije pronađeno.' }, { status: 404 })

  const candidateProjectId = cleanCanonicalProjectId(row?.project_id)
  let workflowResolution = {
    workflowAuthority: 'legacy-compat',
    workflow: null,
  }

  if (candidateProjectId) {
    try {
      const loadResult = await loadOwnedWorkflow(supabase, {
        ownerUserId: user.id,
        projectId: candidateProjectId,
      })
      workflowResolution = resolveWorkflowForLegacySelection(candidateProjectId, loadResult)
    } catch (workflowError) {
      if (workflowError instanceof WorkflowPersistenceError) {
        return privateJson({ error: 'Učitavanje workflowa nije uspjelo.' }, { status: 500 })
      }
      throw workflowError
    }
  }

  if (!projectLocksEnabled()) return privateJson({ ...rowToCamel(row), ...workflowResolution })

  const lockResult = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
  if (!lockResult.ok) return privateJson({ error: 'Provjera zaključavanja projekta nije uspjela.' }, { status: 503 })
  return privateJson({ ...rowToCamel(row), ...workflowResolution, projectLock: lockResult.lock })
}

export async function PUT(req) {
  return withRequestId(await handlePUT(req), getRequestId(req))
}

async function handlePUT(req) {
  const origin = validateSameOriginRequest(req, { allowMissingOrigin: process.env.NODE_ENV !== 'production' })
  if (!origin.ok) return privateJson({ error: origin.error }, { status: origin.status })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return privateJson({ error: 'Prijavi se.' }, { status: 401 })
  if (process.env.NODE_ENV === 'production' && !projectLocksEnabled()) return projectLockUnavailableResponse()

  const parsed = await readJsonBody(req, JSON_BODY_LIMITS.state)
  if (!parsed.ok) return privateJson({ error: parsed.error }, { status: parsed.status })
  let body = parsed.value

  // Product Constitution: document body text is always local-only. This is
  // unconditional and therefore also applies to requests that explicitly opt
  // into the legacy full-sync mode for other free-form wizard fields.
  body = stripManuscriptFromStatePayload(body)

  // Guest-first compatibility: today's Katedra already creates guestProjectId in
  // localStorage before login. During v0.1 it is also accepted as the canonical
  // projectId if a newer UUID projectId has not yet been supplied.
  const projectId = cleanOpaqueId(body?.projectId) || cleanOpaqueId(body?.guestProjectId)
  if (!projectId) return privateJson({ error: 'Nedostaje ID projekta.' }, { status: 400 })

  const projectLookup = await resolveOwnedProjectResult(supabase, { userId: user.id, projectId })
  if (!projectLookup.ok) return privateJson({ error: 'Provjera projekta nije uspjela.' }, { status: 503 })
  const project = projectLookup.value
  const submittedGuestProjectId = cleanOpaqueId(body?.guestProjectId)
  // Once the canonical project exists, its server-resolved guest alias is the
  // only alias that may be written. A stale client alias must not become the
  // upsert conflict key and accidentally rewrite another project row.
  const guestProjectId = project?.guestProjectId || submittedGuestProjectId || projectId
  const isFirstAccountSync = !project && Boolean(submittedGuestProjectId) && submittedGuestProjectId === projectId
  if (!project && !isFirstAccountSync) return privateJson({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  const canonicalProjectId = project?.projectId || projectId

  // Keep the old upsert key alive so current clients do not create duplicate rows.
  // New clients may send both: projectId=canonical UUID, guestProjectId=legacy k... alias.

  const canonicalType = canonicalWorkType(body)
  if (!canonicalType) return privateJson({ error: 'Nepoznata vrsta rada.' }, { status: 400 })

  if (projectLocksEnabled()) {
    const lockResult = project
      ? await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
      : { ok: true, lock: null }
    if (!lockResult.ok) return privateJson({ error: 'Provjera zaključavanja projekta nije uspjela.' }, { status: 503 })
    if (lockResult.lock) {
      const lockValidation = validateLockedProjectMutation(lockResult.lock, {
        projectId: canonicalProjectId,
        topic: Object.prototype.hasOwnProperty.call(body, 'topic') ? body.topic : undefined,
        workType: canonicalType,
      })
      if (!lockValidation.ok) return privateJson({ error: lockValidation.error }, { status: lockValidation.status })
    }
  }

  const patch = {
    user_id: user.id,
    guest_project_id: guestProjectId,
    project_id: canonicalProjectId,
    contract_version: ACADEMIC_SUITE_CONTRACT_VERSION,
    work_type_canonical: canonicalType,
  }

  // Legacy UI column remains required by the current Katedra engine. If a legacy
  // value is supplied, persist it. New canonical-only clients can currently use
  // seminar/final/graduate; unsupported v1 UI types are rejected rather than
  // silently mapped to the wrong legacy value.
  if (body?.workType === 's' || body?.workType === 'z' || body?.workType === 'd') {
    patch.work_type = body.workType
  } else if (canonicalType === 'seminar') patch.work_type = 's'
  else if (canonicalType === 'final') patch.work_type = 'z'
  else if (canonicalType === 'graduate') patch.work_type = 'd'
  else return privateJson({ error: 'Ova vrsta rada još nije podržana u Katedra v1 sučelju.' }, { status: 400 })

  if (Object.prototype.hasOwnProperty.call(body, 'deadline')) {
    const deadline = normalizeDeadline(body.deadline)
    if (deadline === undefined) {
      return privateJson({ error: 'Neispravan datum roka.' }, { status: 400 })
    }
    patch.deadline = deadline
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaCheckedAt')) {
    const checkedAt = normalizeTimestamp(body.lektaCheckedAt)
    if (checkedAt === undefined) {
      return privateJson({ error: 'Neispravno vrijeme Lekta provjere.' }, { status: 400 })
    }
    patch.lekta_checked_at = checkedAt
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaScore')) {
    const score = normalizeNullableInteger(body.lektaScore, 0, 100)
    if (score === undefined) {
      return privateJson({ error: 'Neispravan Lekta rezultat.' }, { status: 400 })
    }
    patch.lekta_score = score
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaFixedTotal')) {
    const fixedTotal = normalizeNullableInteger(body.lektaFixedTotal, 0)
    if (fixedTotal === undefined) {
      return privateJson({ error: 'Neispravan broj riješenih Lekta nalaza.' }, { status: 400 })
    }
    // Database column is NOT NULL; legacy empty/null UI state means zero fixes.
    patch.lekta_fixed_total = fixedTotal ?? 0
  }

  // Full-sync consent never overrides the Constitution's privacy boundary:
  // free-form academic text and document-derived strings stay local.
  const SANITIZERS = {
    unitId: sanitizeUnitId,
    profileId: sanitizeProfileId,
    topic: sanitizeTopic,
    rulesetVersion: sanitizeRulesetVersion,
    checks: sanitizeChecks,
    gen: sanitizeGen,
    hist: sanitizeHist,
    log: sanitizeLog,
    lektaIssues: sanitizeLektaIssues,
  }
  for (const [camel, column] of Object.entries(WRITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, camel)) continue
    const sanitize = SANITIZERS[camel]
    const value = sanitize ? sanitize(body[camel]) : body[camel]
    if (value === undefined) return privateJson({ error: `Neispravan podatak: ${camel}.` }, { status: 400 })
    patch[column] = value
  }

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .upsert(patch, { onConflict: 'user_id,guest_project_id' })
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    if (error.code === '23514' && String(error.message || '').includes(LOCKED_PROJECT_MUTATION_ERROR)) {
      return privateJson({ error: LOCKED_PROJECT_MUTATION_MESSAGE }, { status: 409 })
    }
    if (error.code === '23505') {
      return privateJson(
        { error: 'Projekt je već povezan s drugim računom ili projektom.' },
        { status: 409 },
      )
    }
    return privateJson({ error: 'Spremanje nije uspjelo.' }, { status: 500 })
  }
  return privateJson(rowToCamel(row))
}
