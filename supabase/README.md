# Katedra database authority

Katedra does **not** own a separate Supabase project or an independent migration history.

The canonical backend is the existing **Lekta Supabase** project. Shared Auth, academic projects, Lekta checks, Katedra workflow state, and ecosystem entitlements all live there.

Authoritative database migrations are maintained only in:

`danielrisavi77-create/Lekta/supabase/migrations/`

Current Academic Suite foundation migration:

`0035_academic_suite_foundation.sql`

Katedra consumes that schema through its Supabase clients and API routes. If Katedra needs a database change, add/review the migration in the Lekta repository first; do not add production DDL to this repository.

The file `supabase/migrations/20260805010000_academic_suite_foundation_hardening.sql` is retained only as a deprecated/no-op migration-history marker. It contains no executable production DDL and must not be treated as the Academic Suite schema authority.

Katedra-specific AI-credit tables (`katedra_wallets`, `katedra_topups`, `katedra_usage`) are still product-owned conceptually, but their physical schema also lives in the Lekta Supabase migration history.
