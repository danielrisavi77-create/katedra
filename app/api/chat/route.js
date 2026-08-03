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

const MODELS = new Set(['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'])
const MAX_TOKENS = 8192
const RATE_PER_MIN = 8             // max poziva po korisniku u minuti
const OUTPUT_WEIGHT = 5            // output je ~5× skuplji od inputa (isti omjer za sva tri modela)

// Relativni $/M-weighted-token trošak po modelu, Sonnet = referentna razina na
// kojoj su danas kalibrirani paketi (1.5M/4.5M/12M u app/api/checkout/route.js).
// Bez ovoga bi Opus/Haiku pozivi trošili identičan interni budžet kao Sonnet
// unatoč ~5×/~3× različitom stvarnom trošku (Audit 4 §27-28).
const MODEL_COST_MULTIPLIER = {
  'claude-haiku-4-5-20251001': 1 / 3,
  'claude-sonnet-5': 1,
  'claude-opus-5': 5 / 3,
}

const PASS_SCOPES = ['academic-pass', 'academic-pass-plus']

// "Jedna mala Katedra AI intervencija" po projektu bez Passa (Audit 4 §16-17) —
// malo iznad MIN_BALANCE da jedan kraći odgovor stane, ne obrok.
const FREE_STARTER_TOKENS = 5_000

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

export async function POST(req) {
  // ---------- 1. AUTH ----------
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Prijavi se za korištenje Katedre.' })
  const userId = user.id

  // ---------- 2. INPUT ----------
  let body
  try { body = await req.json() } catch { return json(400, { error: 'Neispravan zahtjev.' }) }
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200)
    return json(400, { error: 'Neispravne poruke.' })
  const model = MODELS.has(body?.model) ? body.model : 'claude-sonnet-5'
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''

  const db = createAdminClient()

  // ---------- 3. RATE LIMIT ----------
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString()
  const { count } = await db
    .from('katedra_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneMinAgo)
  if ((count ?? 0) >= RATE_PER_MIN)
    return json(429, { error: 'Previše zahtjeva — pričekaj minutu.' })

  // ---------- 4. PASS ENTITLEMENT (primarni gate) ----------
  let hasPass = false
  if (projectId) {
    const { data: entitlement } = await db
      .from('entitlements')
      .select('user_id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .in('scope', PASS_SCOPES)
      .eq('status', 'active')
      .maybeSingle()
    hasPass = Boolean(entitlement)
  }

  // ---------- 5. WALLET — interni spend-guard / free-tier starter budžet ----------
  if (!hasPass && projectId) {
    // Jedna besplatna starter dodjela po PROJEKTU (Audit 4 §16-17 "jedna
    // kontekstualna Katedra AI intervencija"), ne po računu — koristi isti
    // idempotentni mehanizam kao pravi Stripe top-up (katedra_topups.stripe_session_id
    // UNIQUE + on-conflict-do-nothing u katedra_grant), pa je siguran pozvati na
    // svaki pokušaj: prvi put upiše balans, svaki sljedeći je no-op.
    // NAPOMENA: p_amount=0 pretpostavlja da RPC/stupac to dopušta — provjeri
    // protiv stvarne Lekta migracije prije produkcije (nije vidljivo iz ovog repoa).
    const { error: freeGrantError } = await db.rpc('katedra_grant', {
      p_user: userId,
      p_tokens: FREE_STARTER_TOKENS,
      p_session: `free:${projectId}`,
      p_amount: 0,
    })
    if (freeGrantError) console.error('free starter grant failed (non-fatal)', freeGrantError)
  }

  const { data: wallet } = await db
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()
  const balance = wallet?.balance ?? 0

  if (balance < MIN_BALANCE) {
    if (!hasPass) {
      // Bez Passa i bez (preostalog) free-tier budžeta — usmjeri na kupnju
      // Passa za OVAJ projekt, ne na generičko "dokupi kredite".
      return json(402, { error: 'Aktiviraj Pass za ovaj projekt.', reason: 'no-pass', balance })
    }
    // Korisnik ima aktivan Pass, ali je dosegnuo interni safety cap. Ne nudimo
    // automatski "kupi još" — Audit 4 §21-22: prvih mjeseci ovo ide na ručni
    // pregled, ne na tihi upsell.
    console.log(JSON.stringify({
      eventName: 'internal_spend_cap_reached', occurredAt: new Date().toISOString(),
      userId, projectId, balance,
    }))
    return json(402, { error: 'Dosegnut je interni sigurnosni limit za ovaj projekt. Javi se podršci.', reason: 'cap-reached', balance })
  }

  // ---------- 6. ANTHROPIC STREAM ----------
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: KATEDRA_SYSTEM_BOUNDARY,
      messages,
    }),
  })
  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text()).slice(0, 300)
    return json(502, { error: 'AI servis nije dostupan.', detail })
  }

  // ---------- 7. PIPE + brojanje tokena + naplata na kraju (i kod prekida) ----------
  let inputTokens = 0
  let outputTokens = 0
  const decoder = new TextDecoder()

  const consume = async () => {
    const weighted = inputTokens + OUTPUT_WEIGHT * outputTokens
    const charged = Math.round(weighted * (MODEL_COST_MULTIPLIER[model] ?? 1))
    await db.rpc('katedra_consume', {
      p_user: userId,
      p_charged: charged,
      p_model: model,
      p_in: inputTokens,
      p_out: outputTokens,
    })
  }

  const counted = upstream.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        for (const ln of decoder.decode(chunk, { stream: true }).split('\n')) {
          if (!ln.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(ln.slice(6))
            if (ev.type === 'message_start' && ev.message?.usage?.input_tokens)
              inputTokens = ev.message.usage.input_tokens
            if (ev.type === 'message_delta' && ev.usage?.output_tokens)
              outputTokens = ev.usage.output_tokens
          } catch { /* partial line */ }
        }
      },
      async flush() { await consume() },
      async cancel() { await consume() }, // klijent prekinuo stream — naplata svejedno prođe
    }),
  )

  return new Response(counted, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-katedra-balance-before': String(balance),
    },
  })
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
