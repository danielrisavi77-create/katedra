// ============================================================
// KATEDRA — free-tier starter budget (Audit 4 §16-17)
//
// "Jedna besplatna Katedra AI intervencija" po PROJEKTU bez Passa, ne po
// računu — malo iznad MIN_BALANCE da jedan kraći odgovor stane, ne obrok.
// Koristi isti idempotentni mehanizam kao pravi Stripe top-up
// (katedra_topups.stripe_session_id UNIQUE + on-conflict-do-nothing u
// katedra_grant), pa je siguran pozvati na svaki pokušaj: prvi put upiše
// balans, svaki sljedeći je no-op.
//
// Zajednički helper za /api/balance (proaktivni header/paywall provjera) i
// /api/chat (stvarni gate) — obje moraju dodijeliti isti budžet PRIJE nego
// izračunaju je li balance nizak, inače proaktivna provjera u balance ruti
// prikazuje paywall prije nego korisnik uopće dobije svoju besplatnu
// intervenciju (bio je to bug: /api/balance je čitao balance=0 i vraćao
// low=true, pa je klijent blokirao poziv prema /api/chat — jedinom mjestu
// gdje se grant stvarno dogodio).
//
// NAPOMENA: p_amount=0 pretpostavlja da RPC/stupac to dopušta — provjeri
// protiv stvarne Lekta migracije prije produkcije (nije vidljivo iz ovog
// repoa).
export const FREE_STARTER_TOKENS = 5_000

export async function ensureFreeStarterGrant(db, userId, projectId) {
  if (!projectId) return
  const { error } = await db.rpc('katedra_grant', {
    p_user: userId,
    p_tokens: FREE_STARTER_TOKENS,
    p_session: `free:${projectId}`,
    p_amount: 0,
  })
  if (error) console.error('free starter grant failed (non-fatal)', error)
}
