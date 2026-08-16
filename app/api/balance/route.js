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
import { lookupActiveProjectPass, lookupActiveProjectPassForProduct } from '@/lib/academic-suite/repositories/entitlements'
import { readProjectLock } from '@/lib/academic-suite/project-lock'
import { resolveOwnedProjectResult } from '@/lib/academic-suite/repositories/projects'
import { isAdminOverrideUser } from '@/lib/auth/admin-access'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'
import { logOperationalEvent } from '@/lib/observability/operational-events'

export async function GET(req) {
  return withRequestId(await handleGET(req), getRequestId(req))
}

async function handleGET(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Prijavi se.' }, { status: 401 })
  if (
    process.env.NODE_ENV === 'production'
    && (process.env.KATEDRA_PROJECT_LOCKS_ENABLED !== 'true' || process.env.KATEDRA_BILLING_RPC_CONTRACT !== 'v2')
  ) {
    console.error(JSON.stringify({ eventName: 'balance_project_contract_unavailable', userId: user.id }))
    return Response.json({ error: 'Stanje AI pristupa još nije konfigurirano za siguran projektni rad.' }, { status: 503 })
  }
  let db
  try {
    db = createAdminClient()
  } catch (error) {
    logOperationalEvent({
      eventName: 'balance_admin_client_unavailable',
      userId: user.id,
      error,
    }, 'error')
    return Response.json({ error: 'Stanje AI pristupa trenutno nije dostupno.' }, { status: 503 })
  }

  const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
  const projectResult = projectId
    ? await resolveOwnedProjectResult(db, { userId: user.id, projectId })
    : { ok: true, value: null }
  if ('error' in projectResult) {
    logOperationalEvent({ eventName: 'balance_project_lookup_failed', userId: user.id, projectId, error: projectResult.error }, 'error')
    return Response.json({ error: 'Projekt trenutačno nije moguće provjeriti.' }, { status: 503 })
  }
  const project = projectResult.value
  if (projectId && !project) {
    return Response.json({ error: 'Projekt nije pronađen za ovaj račun.' }, { status: 404 })
  }

  // This is an explicit account override, not a synthetic Stripe Pass. Keep
  // the project ownership check above and avoid reading entitlement/wallet
  // state for the allowlisted account.
  if (project && isAdminOverrideUser(user)) {
    return Response.json({ hasPass: false, adminOverride: true, unlimited: true, balance: null, low: false })
  }

  let passLookup = { ok: true, active: false }
  if (project) {
    if (process.env.KATEDRA_PROJECT_LOCKS_ENABLED === 'true') {
      const lockResult = await readProjectLock(db, { userId: user.id, projectId: project.projectId })
      if (!lockResult.ok) {
        logOperationalEvent({ eventName: 'project_lock_lookup_unavailable', userId: user.id, projectId: project.projectId, error: lockResult.error }, 'error')
        return Response.json({ error: 'Zaključavanje projekta trenutno nije moguće provjeriti.' }, { status: 503 })
      }
      if (lockResult.lock) {
        passLookup = await lookupActiveProjectPassForProduct(db, {
          userId: user.id,
          projectId: project.projectId,
          productId: `katedra_pass_${lockResult.lock.productKey}`,
        })
      }
    } else {
      // Local/legacy development can still inspect the pre-lock entitlement
      // shape. Production with project locks enabled always takes the exact
      // locked-tier branch above.
      passLookup = await lookupActiveProjectPass(db, { userId: user.id, projectId: project.projectId })
    }
  }
  if (!passLookup.ok) {
    logOperationalEvent({ eventName: 'project_pass_lookup_unavailable', userId: user.id, projectId: project?.projectId, error: passLookup.error }, 'error')
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
    logOperationalEvent({ eventName: 'wallet_lookup_failed', userId: user.id, projectId: project?.projectId, error: walletError }, 'error')
    return Response.json({ error: 'Stanje walleta trenutno nije dostupno.' }, { status: 503 })
  }
  const balance = wallet?.balance ?? 0

  return Response.json({ hasPass, balance, low: balance < MIN_BALANCE })
}
