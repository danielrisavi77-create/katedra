// ============================================================
// KATEDRA — server-side sync cijelog stanja čarobnjaka
//
// Shared-foundation compatibility:
// - legacy Katedra clients may keep sending guestProjectId + workType s/z/d
// - new clients may send projectId + workTypeCanonical
// - server persists BOTH legacy and canonical fields during migration
//
// Raw document content never enters this route.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import {
  ACADEMIC_SUITE_CONTRACT_VERSION,
  fromLegacyKatedraWorkType,
  isAcademicWorkType,
} from '@/lib/academic-suite/contracts'

const COLUMNS =
  'id, project_id, contract_version, unit_id, profile_id, work_type, work_type_canonical, ' +
  'topic, deadline, ruleset_version, lekta_score, lekta_checked_at, lekta_issues, ' +
  'lekta_fixed_total, checks, gen, hist, log, logf, guest_project_id, updated_at'

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

const WRITABLE_FIELDS = {
  unitId: 'unit_id',
  profileId: 'profile_id',
  topic: 'topic',
  deadline: 'deadline',
  rulesetVersion: 'ruleset_version',
  lektaScore: 'lekta_score',
  lektaCheckedAt: 'lekta_checked_at',
  lektaIssues: 'lekta_issues',
  lektaFixedTotal: 'lekta_fixed_total',
  checks: 'checks',
  gen: 'gen',
  hist: 'hist',
  log: 'log',
  logf: 'logf',
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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return Response.json({ error: 'Učitavanje nije uspjelo.' }, { status: 500 })
  return Response.json(rowToCamel(row))
}

export async function PUT(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 })
  }

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

  for (const [camel, column] of Object.entries(WRITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, camel)) patch[column] = body[camel]
  }

  const { data: row, error } = await supabase
    .from('katedra_projects')
    .upsert(patch, { onConflict: 'user_id,guest_project_id' })
    .select(COLUMNS)
    .maybeSingle()

  if (error) return Response.json({ error: 'Spremanje nije uspjelo.' }, { status: 500 })
  return Response.json(rowToCamel(row))
}
