# Master protection and release evidence

Ovaj dokument je operativni ugovor za `master`. GitHub repository setting je
vanjska konfiguracija i mora se provjeriti u samom GitHubu; prisutnost
workflow datoteke sama po sebi ne štiti granu.

## Obavezna pravila

- direktni push na `master` je zabranjen;
- pull request je obavezan;
- najmanje jedna neovisna potvrda je obavezna;
- zastarjeli branch ne smije se mergeati (`strict` required status checks);
- required checks su `Foundation check`, `Academic Suite browser E2E`,
  `Secret scan` i dependency audit koji je dio Foundation checka;
- force-push i brisanje `master` su zabranjeni;
- admin bypass je isključen za produkcijski merge gate.

## Lokalni dokaz u repozitoriju

- `.github/workflows/foundation-check.yml` pokreće dependency audit, testove,
  TypeScript, lint i production build.
- `.github/workflows/academic-suite-browser-e2e.yml` je browser release gate i
  za ručno pokretanje zahtijeva staging konfiguraciju.
- `.github/workflows/secret-scan.yml` je zaseban secret-scan gate.

## Trenutni readback

Na `master` je potvrđen sljedeći GitHub readback:

- strict required checks: `check`, `browser-e2e`, `gitleaks`;
- jedna obavezna potvrda;
- dismiss stale reviews uključen;
- admin enforcement uključen;
- conversation resolution obavezan;
- force-push i brisanje `master` zabranjeni.

Canonical readback endpoint je:
`GET /repos/danielrisavi77-create/katedra/branches/master/protection`.

## GitHub provjera prije prvog plaćenog korisnika

Vlasnik repozitorija mora u `Settings → Rules → Rulesets` ili `Settings →
Branches → Branch protection rules` povremeno ponovno potvrditi da su sva
pravila iznad uključena za `master`. Readback je trenutačno potvrđen, ali status
releasea i dalje može biti `BLOCKED` zbog staginga, vanjskih ugovora ili
nedostajućeg release evidence zapisa.

Minimalni dokaz koji treba priložiti releaseu:

1. URL ili screenshot pravila koje cilja `master`;
2. popis required checksa s točnim imenima workflow jobova;
3. potvrda da je stale branch rejection uključen;
4. testni PR koji ne može mergeati bez Foundation checka i browser E2E-a.

Ne pokušava se zaštita simulirati aplikacijskim kodom. GitHub mora biti
canonical authority za merge policy.
