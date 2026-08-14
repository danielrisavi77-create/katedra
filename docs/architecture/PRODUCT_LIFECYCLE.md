# Katedra product lifecycle

Katedra koristi jedan projektni lifecycle. Besplatni korisnik može izraditi
Completion Scan, osnovni plan i koristiti Lekta Free Check. Plaćeni Pass
otključava capabilityje za jedan canonical `projectId`.

## Product tiers

| Tier | Namjena | Opseg |
| --- | --- | --- |
| `free` | procjena i plan | scan, osnovni plan, Lekta Free Check |
| `seminarski` | kraći rad | struktura, literatura, pisanje i revizija |
| `zavrsni` | završni rad | istraživačko pitanje, metodologija, mentor i obrana |
| `diplomski` | napredni istraživački rad | istraživački dizajn, podatci, revizije i obrana |

`resolveProjectCapability()` na serveru prvo provjerava vlasništvo projekta,
zatim canonical lock i aktivni Project Pass. Klijentski payload ne određuje
product tier, zaključanu temu ili dostupne capabilityje.

## Privacy boundary

Rukopis i njegove lokalne verzije ostaju canonical u IndexedDB-u. `/api/state`
smije primiti samo projektne metapodatke. Agent run payloadi pripadaju Lekta
ugovoru i imaju privremeni TTL; nikada nisu zamjena za lokalni rukopis.
