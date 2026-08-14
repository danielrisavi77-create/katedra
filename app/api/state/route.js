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
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { readProjectLock, validateLockedProjectMutation } from '../../../lib/academic-suite/project-lock'
import { stripManuscriptFromStatePayload } from '@/lib/manuscript/privacy'
import { getRequestId, withRequestId } from '../../../lib/observability/request-id.js'

const COLUMNS =
  'id, project_id, contract_version, unit_id, profile_id, work_type, work_type_canonical, ' +
  'topic, deadline, ruleset_version, lekta_score, lekta_checked_at, lekta_issues, ' +
  'lekta_fixed_total, checks, gen, hist, log, logf, guest_project_id, updated_at'

const KATEDRA_PROJECT_LOCKS_ENABLED = process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true'

function rowToCamel(row) {
  if (!row) return {}
  return {
    id: row.id,
    projectId: row.project_id,
    contractVersion: row.contract_version,
    unitId: row.unit_id,
    profileId: row.profile_id,
    workType: row.work_type, // legacy UI compatibility
    workTypeCanonical: row.work_type_canonical,
    topic: row.topic,
    deadline: row.deadline,
    rulesetVersion: row.ruleset_version,
    lektaScore: row.lekta_score,
    lektaCheckedAt: row.lekta_checked_at,
    lektaIssues: row.lekta_issues,
    lektaFixedTotal: row.lekta_fixed_total,
    checks: row.checks,
    gen: row.gen,
    hist: row.hist,
    log: row.log,
    logf: row.logf,
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
  logf: 'logf',
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
    if (Object.prototype.hasOwnProperty.call(raw, key)) safe[key] = raw[key]
  }
  return safe
}
function sanitizeHist(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((e) => ({ t: e?.t, mode: e?.mode, tip: e?.tip }))
}
function sanitizeLog(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((e) => {
    const safe = { t: e?.t }
    for (const key of LOG_SERVER_SAFE_KEYS) {
      if (e && Object.prototype.hasOwnProperty.call(e, key)) safe[key] = e[key]
    }
    return safe
  })
}

function cleanOpaqueId(value) {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  // Opaque IDs are not parsed for semantics, but reject obviously unsafe payloads.
  if (!id || id.length > 200) return ''
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
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const projectId = cleanOpaqueId(new URL(req.url).searchParams.get('projectId'))
  if (!projectId) return Response.json({ error: 'Nedostaje ID projekta.' }, { status: 400 })

  const project = await resolveOwnedProject(supabase, { userId: user.id, projectId })
  if (!project) return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .eq('project_id', project.projectId)
    .maybeSingle()

  if (error) return Response.json({ error: 'Učitavanje nije uspjelo.' }, { status: 500 })
  if (!KATEDRA_PROJECT_LOCKS_ENABLED) return Response.json(rowToCamel(row))

  const lockResult = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
  if (!lockResult.ok) return Response.json({ error: 'Provjera zaključavanja projekta nije uspjela.' }, { status: 503 })
  return Response.json({ ...rowToCamel(row), projectLock: lockResult.lock })
}

export async function PUT(req) {
  return withRequestId(await handlePUT(req), getRequestId(req))
}

async function handlePUT(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 })
  }

  // Product Constitution: document body text is always local-only. This is
  // unconditional and therefore also applies to requests that explicitly opt
  // into the legacy full-sync mode for other free-form wizard fields.
  body = stripManuscriptFromStatePayload(body)

  // Guest-first compatibility: today's Katedra already creates guestProjectId in
  // localStorage before login. During v0.1 it is also accepted as the canonical
  // projectId if a newer UUID projectId has not yet been supplied.
  const projectId = cleanOpaqueId(body?.projectId) || cleanOpaqueId(body?.guestProjectId)
  if (!projectId) return Response.json({ error: 'Nedostaje ID projekta.' }, { status: 400 })

  // Keep the old upsert key alive so current clients do not create duplicate rows.
  // New clients may send both: projectId=canonical UUID, guestProjectId=legacy k... alias.
  const guestProjectId = cleanOpaqueId(body?.guestProjectId) || projectId

  const canonicalType = canonicalWorkType(body)
  if (!canonicalType) return Response.json({ error: 'Nepoznata vrsta rada.' }, { status: 400 })

  if (KATEDRA_PROJECT_LOCKS_ENABLED) {
    const lockResult = await readProjectLock(supabase, { userId: user.id, projectId: project.projectId })
    if (!lockResult.ok) return Response.json({ error: 'Provjera zaključavanja projekta nije uspjela.' }, { status: 503 })
    if (lockResult.lock) {
      const lockValidation = validateLockedProjectMutation(lockResult.lock, {
        projectId: project.projectId,
        topic: Object.prototype.hasOwnProperty.call(body, 'topic') ? body.topic : undefined,
        workType: canonicalType,
      })
      if (!lockValidation.ok) return Response.json({ error: lockValidation.error }, { status: lockValidation.status })
    }
  }

  const patch = {
    user_id: user.id,
    guest_project_id: guestProjectId,
    project_id: projectId,
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
  else return Response.json({ error: 'Ova vrsta rada još nije podržana u Katedra v1 sučelju.' }, { status: 400 })

  if (Object.prototype.hasOwnProperty.call(body, 'deadline')) {
    const deadline = normalizeDeadline(body.deadline)
    if (deadline === undefined) {
      return Response.json({ error: 'Neispravan datum roka.' }, { status: 400 })
    }
    patch.deadline = deadline
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaCheckedAt')) {
    const checkedAt = normalizeTimestamp(body.lektaCheckedAt)
    if (checkedAt === undefined) {
      return Response.json({ error: 'Neispravno vrijeme Lekta provjere.' }, { status: 400 })
    }
    patch.lekta_checked_at = checkedAt
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaScore')) {
    const score = normalizeNullableInteger(body.lektaScore, 0, 100)
    if (score === undefined) {
      return Response.json({ error: 'Neispravan Lekta rezultat.' }, { status: 400 })
    }
    patch.lekta_score = score
  }

  if (Object.prototype.hasOwnProperty.call(body, 'lektaFixedTotal')) {
    const fixedTotal = normalizeNullableInteger(body.lektaFixedTotal, 0)
    if (fixedTotal === undefined) {
      return Response.json({ error: 'Neispravan broj riješenih Lekta nalaza.' }, { status: 400 })
    }
    // Database column is NOT NULL; legacy empty/null UI state means zero fixes.
    patch.lekta_fixed_total = fixedTotal ?? 0
  }

  // Full-sync consent never overrides the Constitution's privacy boundary:
  // free-form academic text and document-derived strings stay local.
  const SANITIZERS = { gen: sanitizeGen, hist: sanitizeHist, log: sanitizeLog }
  for (const [camel, column] of Object.entries(WRITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, camel)) continue
    const sanitize = SANITIZERS[camel]
    patch[column] = sanitize ? sanitize(body[camel]) : body[camel]
  }

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .upsert(patch, { onConflict: 'user_id,guest_project_id' })
    .select(COLUMNS)
    .maybeSingle()

  if (error) return Response.json({ error: 'Spremanje nije uspjelo.' }, { status: 500 })
  return Response.json(rowToCamel(row))
}
