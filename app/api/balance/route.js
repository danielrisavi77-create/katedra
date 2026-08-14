// ============================================================
// KATEDRA — stanje Passa (za header + proaktivni paywall,
// bez čekanja na 402 iz chata)
//
// Audit 4: primarni signal korisniku je Pass status po projektu, ne sirovi
// wallet balance. balance/low ostaju u odgovoru za interne proaktivne
// provjere u workspace klijentu), ne za prikaz broja.
//
// FIX: ova ruta mora dodijeliti isti free-starter budžet kao /api/chat PRIJE
// nego pročita balance — inače je za posve nov projekt balance=0, low=true,
// pa klijent (katedraNeedsPass) proaktivno prikaže paywall i NIKAD ne pozove
// /api/chat, gdje se grant stvarno dogadao. Rezultat bez ovoga: obećana
// "jedna besplatna intervencija" (Audit 4 §16-17) je bila nedostižna kroz
// normalan UI tok. V. lib/katedra-free-starter.js za idempotentni mehanizam.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIN_BALANCE } from '@/lib/limits'
import { ensureFreeStarterGrant } from '@/lib/katedra-free-starter'
import { authorizeProjectAiRequest } from '@/lib/ai/project-access'
import { lookupActiveProjectPass } from '@/lib/academic-suite/repositories/entitlements'
import { resolveOwnedProject } from '@/lib/academic-suite/repositories/projects'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'

export async function GET(req) {
  return withRequestId(await handleGET(req), getRequestId(req))
}

async function handleGET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  const db = createAdminClient()

  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const project = projectId
    ? await resolveOwnedProject(db, { userId: user.id, projectId })
    : null
  if (projectId && !project) {
    return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  }

  const passLookup = project
    ? await lookupActiveProjectPass(db, { userId: user.id, projectId: project.projectId })
    : { ok: true, active: false }
  if (!passLookup.ok) {
    console.error(JSON.stringify({ eventName: 'project_pass_lookup_unavailable', userId: user.id, projectId: project?.projectId, error: passLookup.error }))
    return Response.json({ error: 'Stanje Passa trenutno nije moguće provjeriti.' }, { status: 503 })
  }
  const hasPass = passLookup.active

  const billingContractEnabled = process.env.KATEDRA_BILLING_RPC_CONTRACT === 'v2'
  let projectAccess = null
  if (!hasPass && project && billingContractEnabled) {
    projectAccess = await authorizeProjectAiRequest(db, {
      userId: user.id,
      projectId: project.projectId,
      hasPass,
    })
    if (!projectAccess.allowed) {
      if (projectAccess.reason === 'unavailable') {
        return Response.json({ error: 'Projektni AI pristup trenutno nije moguće provjeriti.' }, { status: 503 })
      }
      const balance = projectAccess.balance ?? 0
      return Response.json({ hasPass: false, balance, low: true, reason: 'no-pass' })
    }
    if (projectAccess.balance == null) {
      return Response.json({ error: 'Projektni wallet trenutno nije moguće provjeriti.' }, { status: 503 })
    }
  }

  if (!hasPass && project && !billingContractEnabled) {
    await ensureFreeStarterGrant(db, user.id, project.projectId)
  }

  if (projectAccess?.allowed) {
    const balance = projectAccess.balance
    return Response.json({ hasPass: false, balance, low: balance < MIN_BALANCE })
  }

  const { data: wallet, error: walletError } = await db
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()
  if (walletError) {
    console.error(JSON.stringify({ eventName: 'wallet_lookup_failed', userId: user.id, projectId: project?.projectId, error: walletError.message }))
    return Response.json({ error: 'Stanje walleta trenutno nije dostupno.' }, { status: 503 })
  }
  const balance = wallet?.balance ?? 0

  return Response.json({ hasPass, balance, low: balance < MIN_BALANCE })
}
