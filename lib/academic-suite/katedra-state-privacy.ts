// Katedra-only privacy allowlist for the `/api/state` sync path.
//
// Deliberately NOT in contracts.ts: that file is a MIRROR of the
// cross-product contract also maintained in the Lekta repo (see its header
// comment — changes there need a synchronized update on both sides). This
// allowlist governs Katedra's own legacy wizard field IDs (`GEN_IDS` in
// app/katedra-engine.js) and has no meaning to Lekta — it doesn't belong in
// a file whose whole point is staying byte-for-byte mirrored.
//
// Audit 5: the shared backend (`katedra_projects.gen/hist/log`, a Lekta
// Supabase table) must never receive free-form academic content — mentor
// instructions, attached-material descriptions, concerns, text-to-improve,
// research questions (see PRODUCT_CONSTITUTION.md "Privatnost"). This is an
// ALLOWLIST, not a denylist, so any new GEN_IDS field added later is
// excluded from server sync by default until someone deliberately adds it
// here — fail closed, not fail open.
//
// Both the client (app/katedra-engine.js, gatherGenForServer()) and the
// server (app/api/state/route.js, sanitizeGen()) import this SAME constant
// so there is no drift risk between what the client intends to send and
// what the server is willing to persist.
export const GEN_SERVER_SAFE_KEYS = [
  'f_fakultet',
  'f_kolegij',
  'f_opseg',
  'f_izvori',
  'f_stil',
  'f_rok',
  'f_radfile',
  'f_trajanje',
  'f_datumobr',
  'wc_total',
  'wc_unit',
  'f_brutal',
  'a_gradja',
  'a_checkpoint',
  'u_skills',
  'a_learn',
  'aiAck',
]
