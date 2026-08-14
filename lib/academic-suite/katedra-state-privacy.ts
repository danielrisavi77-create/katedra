// Katedra-only privacy allowlist for the `/api/state` sync path.
//
// Deliberately NOT in contracts.ts: that file is a MIRROR of the
// cross-product contract also maintained in the Lekta repo (see its header
// comment — changes there need a synchronized update on both sides). This
// allowlist governs Katedra's legacy wizard field IDs and has no meaning to
// Lekta — it doesn't belong in
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
// The server (app/api/state/route.js, sanitizeGen()) imports this constant.
// The current React workspace sends only metadata; keeping this allowlist
// here preserves a fail-closed boundary for legacy clients during migration.
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

// Same allowlist pattern, applied to `log` entries (Project Ledger v1 —
// local process entries). Only the timestamp `t` and these
// ADDITIONAL structured fields may pass through — short
// enums/ids/numbers only, never free text. The free-form `txt` field is
// intentionally dropped by the server. A field not listed here is
// dropped on sync, same fail-closed default as GEN_SERVER_SAFE_KEYS.
//
// aiGenerated/tool/model/reviewed/stage come from the honest AI ledger
// (Faze 2-4 review) — all short enums/booleans/model-id strings, never the
// actual AI response or prompt text.
export const LOG_SERVER_SAFE_KEYS = [
  'kind',
  'phaseId',
  'level',
  'mode',
  'files',
  'lekta_result',
  'done',
  'skip',
  'open',
  'aiGenerated',
  'tool',
  'model',
  'reviewed',
  'stage',
]
