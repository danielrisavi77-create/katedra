# Agent artifact provenance

Katedrin agent run više ne koristi samo izvorni rukopis kao kontekst svakog
koraka. Svaki verificirani korak sprema privremeni rezultat s `stepOrder`,
`attempt` i `inputArtifactIds`. Sljedeći korak smije dobiti samo najnoviji
verificirani rezultat ranijih koraka.

## Pravila lanca

- rezultat sa statusom `needs_revision`, `blocked` ili `failed` nikada ne ulazi
  u sljedeći prompt;
- budući koraci i rezultati izvan traženog `runId`/`projectId` se odbacuju;
- za isti korak bira se najveći verificirani pokušaj;
- međurezultat se u promptu ograničava na 120.000 znakova po artefaktu i
  600.000 znakova ukupno;
- `inputArtifactIds` omogućuje naknadnu rekonstrukciju razloga za rezultat,
  bez spremanja punog rukopisa u shared state;
- privatni result objekti se pišu immutable (`upsert: false`), a ponovljeni
  identični upload prihvaća se bez prepisivanja.

## Izvori

Providerov `verified` flag se nikada ne prihvaća kao dokaz. Provider vraća samo
kandidate, nakon čega server:

- DOI provjerava preko fiksnog Crossref endpointa i uspoređuje naslov/godinu;
- proizvoljni URL ne dohvaća sa servera zbog SSRF rizika, nego ga ostavlja u
  `needs_review` stanju;
- agenticni source/writing/citation/review verifikatori zahtijevaju
  `verification.status === 'verified'` za svaki korišteni izvor.

## Capability routing

- tekstualni koraci koriste Anthropic adapter;
- skenovi mogu koristiti Anthropic vision samo kada je
  `KATEDRA_ANTHROPIC_VISION_ENABLED=true`;
- web research koristi samo server-side gateway s HTTPS URL-om, ključem,
  modelom i eksplicitno odobrenom policy zastavicom;
- bez konfiguracije provider router baca capability error, a worker ostaje
  fail-closed.

Ovaj dokument opisuje lokalni ugovor. Aktivacija produkcijskog rada i dalje
zahtijeva deploy Lekta migracija/RPC-a, RLS provjeru i staging E2E s pravim
testnim credentialima.
