// ============================================================
// KATEDRA — server-side sync cijelog stanja čarobnjaka
// (checklist, generator polja, povijest promptova, dnevnik procesa,
// Lekta projekt manifest). Jedan red po (user_id, guest_project_id) —
// guest_project_id je klijentski generiran ID (isti kao lokalni
// projectId u localStorage) i jedini je upsert ključ.
// GET  → zadnje ažuriran redak prijavljenog korisnika (ili {} ako nema)
// PUT  → upsert (samo poslana polja se mijenjaju na postojećem retku)
// ============================================================
import { createClient } from '@/lib/supabase/server'

const COLUMNS =
  'id, unit_id, profile_id, work_type, topic, deadline, ruleset_version, ' +
  'lekta_score, lekta_checked_at, lekta_issues, lekta_fixed_total, ' +
  'checks, gen, hist, log, logf, guest_project_id, updated_at'

function rowToCamel(row) {
  if (!row) return {}
  return {
    id: row.id,
    unitId: row.unit_id,
    profileId: row.profile_id,
    workType: row.work_type,
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
  workType: 'work_type',
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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  const { data: row } = await supabase
    .from('katedra_projects')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json(rowToCamel(row))
}

export async function PUT(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 }) }

  const guestProjectId = typeof body?.guestProjectId === 'string' ? body.guestProjectId.trim() : ''
  if (!guestProjectId) return Response.json({ error: 'Nedostaje ID projekta.' }, { status: 400 })

  const patch = { user_id: user.id, guest_project_id: guestProjectId }
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
