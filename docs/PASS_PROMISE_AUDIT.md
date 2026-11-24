# Pass promise audit — V1

Ovaj zapis je lokalni dokaz da komercijalni katalog, checkout metadata,
server-side capability matrix i Pass dijalog koriste isti V1 opseg.

## Zaključeni V1 opseg

Seminarski, završni i diplomski Pass trenutno obećavaju isti stvarno dostupni
workflow: projektni plan, rukopis po sekcijama, kontekstualnu AI pomoć, lokalnu
biblioteku izvora, mentorove zadatke, lokalne verzije, AI zapis i Lekta handoff.

To nije skrivena razlika u broju tokena. Budući moduli kao metodološki builder,
research design canvas, evidence matrix, ciklusi mentorove revizije i simulator
obrane nisu u V1 Pass katalogu niti ih UI predstavlja kao dostupne.

## Jedinstveni izvor provjere

`lib/product/promise-contract.ts` provjerava da za svaki paid tier:

- Stripe katalog i canonical entitlement `productId` odgovaraju;
- checkout koristi isti paketni identitet;
- capability matrix odgovara obećanom tieru;
- Pass dijalog prikazuje samo stvarne V1 module;
- nijedan budući modul nije slučajno izložen kao plaćena funkcija.

Provjera je pokrivena testom:

```text
lib/product/promise-contract.test.ts
```

## Granica releasea

Ovaj audit dokazuje usklađenost lokalnog koda i ne dokazuje staging naplatu,
canonical entitlement, refund ili produkcijski payment event. Ti dokazi ostaju
u [staging release checklistu](./release/STAGING_MONEY_FLOW.md) i zahtijevaju
stvarne Stripe/Supabase credentials.
