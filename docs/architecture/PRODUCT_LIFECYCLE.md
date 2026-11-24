# Katedra product lifecycle

Katedra koristi jedan projektni lifecycle. Besplatni korisnik može izraditi
Completion Scan, osnovni plan i koristiti Lekta Free Check. Plaćeni Pass
otključava capabilityje za jedan canonical `projectId`.

## Product tiers

| Tier | Namjena | Opseg |
| --- | --- | --- |
| `free` | procjena i plan | scan, osnovni plan, Lekta Free Check |
| `seminarski` | plaćeni V1 workflow | projektni plan, rukopis po sekcijama, kontekstualna AI pomoć, izvori i verifikacija, mentorovi zadaci, lokalne verzije, AI zapis i Lekta handoff |
| `zavrsni` | plaćeni V1 workflow | isti stvarni modulni opseg; akademski profil određuje pravila rada |
| `diplomski` | plaćeni V1 workflow | isti stvarni modulni opseg; akademski profil određuje pravila rada |

V1 namjerno ne prodaje module koji još nemaju vlastitu stvarnu površinu i
persistirano stanje: Research Design Canvas, Methodology Builder, Evidence
Matrix, Mentor Review Cycles i Defense Simulator. Njihovi capability ID-jevi
ostaju u tipu radi kompatibilnosti, ali nisu u `PRODUCT_CAPABILITIES` dok ne
postoje ekran, korisnička akcija, spremanje i release E2E.

`resolveProjectCapability()` na serveru prvo provjerava vlasništvo projekta,
zatim canonical lock i aktivni Project Pass. Klijentski payload ne određuje
product tier, zaključanu temu ili dostupne capabilityje.

Chat zahtjevi u zaključanom production flowu moraju navesti poznatu
capability vrijednost. `contextual_ai` je namjerno odvojena od generiranja
cijelih sekcija; prazne ili nepoznate vrijednosti odbijaju se umjesto da
upadnu u legacy fallback.

## Privacy boundary

Rukopis i njegove lokalne verzije ostaju canonical u IndexedDB-u. `/api/state`
smije primiti samo projektne metapodatke. Agent run payloadi pripadaju Lekta
ugovoru i imaju privremeni TTL; nikada nisu zamjena za lokalni rukopis.

## Academic Context Compiler

`public/katedra-pack.json` je read-only artifact koji sadrži podatke o
ustanovama i profilima. `lib/academic-context/` ga sanitizira, razrješava
prema canonical `unitId`/`profileId` i kompajlira u jedan bounded
`AcademicContext`. Taj objekt je jedini akademski kontekst koji se prosljeđuje
u Completion Scan, početni outline, Project Home, Pravila, AI promptove,
agent payload, export upozorenja i Lekta handoff.

Kompajlirani objekt sadrži i bounded `sourcePlan` (cilj izvora, knjiga,
citatni stil, službeni izvori i source-gate pravilo) te `methodologyPlan`
(eksplicitno pronađene metodološke sekcije/provjere i njihov status). Ti
planovi ne izmišljaju fakultetske zahtjeve kada ih pack ne navodi.

Kompajler ne vjeruje klijentskom statusu. Profil je `verified` samo kada pack
ima status `verified` i stvarni datum provjere. Nevažeći ili nedostajući datum
downgrada profil u `partial`; zastarjeli valjani datum ostaje vidljiv kao
advisory upozorenje. `partial`, `research` i `generic` profili dobivaju samo
opći/coaching način rada i ne mogu se prikazati kao potvrđena fakultetska
pravila niti otključati faculty Pass.

Svaki prikaz pravila mora pokazati status, a kada postoji i datum te službene
izvore. `serializeAcademicContext()` je namjerno ograničen: ne prenosi cijeli
pack, nepoznata raw polja ni nepotrebne submission činjenice. Server ponovno
razrješava kontekst za capability i chat zahtjeve, pa klijent ne može lažnim
profilom dobiti verified mogućnosti.

## V1 loop evidence

Lokalni rukopis ima Version Browser u IndexedDB-u. Prva korisnička izmjena u
jednoj sesiji uređivanja sprema prethodno stanje s oznakom `user_change`, a
nakon mirovanja ili promjene sekcije počinje nova sesija. AI prijedlog, uvoz,
mentorova revizija i vraćanje imaju zasebne oznake; Version Browser prikazuje
prije/poslije, diff te vraćanje sekcije ili cijelog rukopisa.

Rok koristi lokalni banner s jednom preporučenom radnjom vezanom uz fazu.
E-mail podsjetnik postoji samo nakon izričite privole prijavljenog korisnika i
može se isključiti istom projektnom kontrolom.

Completion nije samo “sve sekcije odobrene”. Projekt prelazi u `completed`
samo kada postoji Lekta rezultat sa scoreom 100, datumom provjere i bez
otvorenih nalaza. Inače ostaje u fazi `lekta`.

Product analytics je allowlistan u canonical Lekta migraciji
`0087_katedra_product_analytics_events.sql`. `katedra_product_loop_stats()`
namjerno računa završene projektne loopove kao sjevernu zvijezdu; broj AI
odgovora nije kriterij dovršenosti.

## Analytics trust boundary

The product-event table is canonical, but browser telemetry is not allowed to
assert server facts. The browser endpoint accepts only user-action events.
`purchase_completed`, `agent_run_completed`, `lekta_recheck_completed` and
`project_completed` are server-only events. In particular,
`project_completed` must be emitted by the canonical Lekta completion handoff;
the local manifest is not sufficient evidence for the north-star metric.

The Lekta migration
`0088_katedra_product_completion_contract.sql` defines that handoff:
it requires the canonical `latest_analysis_id`, score `100`, a verification
timestamp and no open findings, then atomically marks the academic project
completed and inserts the idempotent event. The RPC is service-role-only and
must be deployed and exercised in staging before the completion metric is used
for a release decision.
