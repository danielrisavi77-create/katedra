# Agenticni run contract — Lekta handoff

Katedra koristi postojeći Lekta Supabase kao canonical backend. Ovaj dokument je ugovor za koordinirani Lekta migration/RPC posao; Katedra ga ne primjenjuje sama.

## Required tables

`katedra_project_locks` mora imati jedinstveni zaključani zapis po `project_id`, uz `user_id`, `topic`, `work_type`, `product_key`, `payment_id`, `locked_at` i `status`. `payment_id` mora biti idempotentan.

`agent_runs` mora sadržavati `run_id`, `user_id`, `project_id`, `mode`, `source_policy`, `status`, `created_at` i `updated_at`.

`agent_steps` mora sadržavati `step_id`, `run_id`, `project_id`, `agent`, `verifier`, `section_id`, `step_order`, `attempt`, `status`, `last_verification`, `lease_owner`, `lease_expires_at`, `created_at` i `updated_at`.

## Required invariants

- RLS ograničava sve redove na vlasnika projekta.
- Jedan `project_id` može imati samo jedan aktivni lock.
- Jedan `payment_id` ne može zaključati više projekata.
- Claim koraka je atomican i lease istječe bez ručnog čišćenja.
- Korak se ne može označiti `verified` bez prethodnog pripadajućeg agenta i verifikatora.
- `attempt` je ograničen na 1–3.
- `blocked` i `completed` runovi ne mogu se ponovno pokrenuti bez novog runa.
- Temporary payload ima default TTL 72 sata i apsolutni TTL 7 dana.

## Required functions

Implementirati atomic `lock_paid_project`, `create_agent_run`, `claim_agent_step`, `complete_agent_step`, `attach_agent_payloads_to_run` i idempotent cleanup funkciju u Lekta migration historyju. Katedra ih može uključiti tek nakon staging provjere i postavljanja `KATEDRA_PROJECT_LOCKS_ENABLED=true` i `KATEDRA_AGENT_RUNS_ENABLED=true`.

Katedra poziva RPC-e ovim parametrima:

- `lock_paid_project(p_user_id, p_project_id, p_topic, p_work_type, p_product_key, p_payment_id, p_locked_at)` — mora biti idempotentan po `payment_id` i `project_id`.
- `create_agent_run(p_user_id, p_project_id, p_mode, p_source_policy, p_section_ids?)` — atomically stvara run i početne sekvencijalne korake; `p_section_ids` je opcionalan jer se rukopis canonicalno čuva lokalno.
- `claim_agent_step(p_run_id, p_worker_id)` — vraća samo jedan korak s aktivnim leaseom ili `null`.
- `complete_agent_step(p_run_id, p_step_id, p_status, p_attempt, p_provider, p_usage, p_verification, p_requeue)` — jedini način promjene rezultata koraka; `p_requeue=true` vraća neuspjeli pokušaj u red do maksimalno tri pokušaja.
- `cleanup_expired_agent_payloads(p_now)` — idempotentno uklanja samo temporary payload manifeste kojima je istekao TTL.
- `attach_agent_payloads_to_run(p_user_id, p_project_id, p_run_id, p_material_ids)` — veže samo žive, još nedodijeljene materijale vlasnika uz aktivni run.

Katedrin adapteri u `lib/academic-suite/project-lock.ts` i `lib/agents/backend-contract.ts` namjerno fail-closed ako RPC nije dostupan. Nema direktnog production fallback upisa u lock/run/step tablice.

## Worker lifecycle

`/api/internal/agent-worker` je privatni Katedra worker endpoint. Prihvaća samo
dedicirani `KATEDRA_AGENT_WORKER_TOKEN`, atomarno claim-a jedan korak, učitava
privatni rukopis/materijale, izvršava provider kroz billing reservation i
poziva completion RPC. Jedan poziv obrađuje najviše jedan korak.

Lekta Edge funkcija `katedra-agent-worker` periodično dohvaća samo `pending` i
`running` runove te ih dispatch-a na taj endpoint. Ona koristi zasebni
`KATEDRA_AGENT_WORKER_CRON_SECRET`; service-role ključ se ne šalje Katedra
endpointu. Ako callback ne uspije, funkcija vraća 502 kako bi cron ponovio
poziv, dok lease/claim zaštita sprječava dvostruku obradu istog koraka.

## Run-context payload

Novi agent-run mora uz zahtjev dobiti lokalni snapshot rukopisa. Katedra ga prije odgovora klijentu:

- validira prema `ManuscriptV1` shemi i canonical `projectId`-u;
- sanitizira tako da se u payload sprema samo validirani `manuscript` objekt;
- sprema u privatni bucket pod namespaceom `user/project/run`;
- registrira kroz `register_agent_payload` s default TTL-om od 72 sata i maksimumom od 7 dana.

Canonical run metadata ne sadrži tekst rukopisa. Ako upload ili registracija ne uspije, server otkazuje upravo stvoreni run kako ne bi ostao aktivan bez konteksta. Endpoint za ponovni upload konteksta služi samo za aktivan, vlasnički run.

Dok ugovor nije deployan, Katedra endpointi za agent runove vraćaju `503`, a state lock enforcement ostaje isključen kako lokalni development bez nove sheme ne bi lažno prikazao aktivan Pass.

## Security advisor interpretation

Neki owner-facing RPC-i (`create_agent_run`, `register_agent_payload`,
`attach_agent_payloads_to_run`, `pause_agent_run`, `resume_agent_run` i
`cancel_agent_run`) su `SECURITY DEFINER` i namjerno imaju `EXECUTE` za
`authenticated` rolu. To je potrebno za atomarne upise nad tablicama kojima
authenticated korisnici nemaju direktan write grant. Svaki takav RPC prije
mutacije provjerava `auth.uid() = p_user_id`, vlasništvo projekta, aktivni
lock/entitlement gdje je primjenjivo, validaciju ulaza i ograničenja veličine.

Worker-only RPC-i (`claim_agent_step`, `complete_agent_step`, cleanup i
`lock_paid_project`) ostaju dostupni samo `service_role` roli. Supabase advisor
upozorenje za authenticated `SECURITY DEFINER` funkciju zato je očekivani,
ali nadzirani trade-off, a ne razlog za automatsko ignoriranje drugih
security nalaza. Svaka nova funkcija mora dobiti isti owner/role test prije
staging odobrenja.

Ako provider router ne pronađe traženi capability (`vision` ili
`web_research`), worker ne pokušava fallback na tekstualni provider i ne
naplaćuje poziv. Korak se završava kao `blocked` s razlogom
`provider_capability_unavailable`, kako bi staging konfiguracija morala
eksplicitno uključiti odgovarajući provider.
