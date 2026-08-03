// ============================================================
// KATEDRA — streaming proxy prema Anthropic API-ju
// Ključ živi SAMO ovdje (env). Klijent šalje postojeću Supabase
// sesiju (cookie) — ista app, isti origin.
// Tok: auth → provjera kredita → stream → naplata (input + 5×output).
// Sirovi Anthropic SSE se prosljeđuje bajt-po-bajt nepromijenjen —
// frontend parsira izvorni Anthropic stream format.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIN_BALANCE } from '@/lib/limits'

const MODELS = new Set(['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'])
const MAX_TOKENS = 8192
const RATE_PER_MIN = 8             // max poziva po korisniku u minuti
const OUTPUT_WEIGHT = 5            // output je ~5× skuplji od inputa

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

  const db = createAdminClient()

  // ---------- 3. RATE LIMIT + KREDITI ----------
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString()
  const { count } = await db
    .from('katedra_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneMinAgo)
  if ((count ?? 0) >= RATE_PER_MIN)
    return json(429, { error: 'Previše zahtjeva — pričekaj minutu.' })

  const { data: wallet } = await db
    .from('katedra_wallets')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()
  const balance = wallet?.balance ?? 0
  if (balance < MIN_BALANCE)
    return json(402, { error: 'Nemaš dovoljno kredita.', balance, topup: true })

  // ---------- 4. ANTHROPIC STREAM ----------
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

  // ---------- 5. PIPE + brojanje tokena + naplata na kraju (i kod prekida) ----------
  let inputTokens = 0
  let outputTokens = 0
  const decoder = new TextDecoder()

  const consume = async () => {
    const charged = inputTokens + OUTPUT_WEIGHT * outputTokens
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
      // Klijent nikad ne šalje model (v. MODELS default gore) — ovo mu javlja
      // koji je STVARNO odgovorio, za lokalni AI ledger (rpLog), umjesto da
      // klijent pogađa/pretpostavlja vrijednost koju server odluči promijeniti.
      'x-katedra-model': model,
    },
  })
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
