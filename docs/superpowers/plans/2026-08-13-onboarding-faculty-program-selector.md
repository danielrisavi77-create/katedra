# Fakultet i smjer u `/pisi` onboardingu

> **Napomena:** Plan se izvršava u postojećem workspaceu, uz testove prije
> implementacije i bez novih ovisnosti.

## 1. Katalog i pretraga

**Datoteke:**
- Create: `lib/manuscript/academic-catalog.ts`
- Create: `lib/manuscript/academic-catalog.test.ts`

Iz postojećeg pack formata izvesti tipizirani katalog, normalizaciju upita i
pretragu fakulteta po ID-u, nazivu i ustanovi. Profile filtrirati po `unitId` i
vrsti rada. Testirati `FPZG`, puni naziv, dijakritike i filtriranje profila.

## 2. Pretraživi odabiri u onboardingu

**Datoteke:**
- Modify: `app/pisi/components/onboarding-flow.tsx`
- Modify: `app/pisi/components/onboarding-flow.test.tsx`
- Modify: `app/pisi/pisi.css`

Učitati postojeći javni katalog klijentski, zamijeniti slobodno polje fakulteta
comboboxom s fallbackom i dodati filtrirani combobox za "Smjer / studij".
Testirati da odabir `FPZG` vraća canonical ID-eve i da se ručni unos ne briše.

## 3. Lokalno spremanje i postojeći projekt

**Datoteke:**
- Modify: `lib/manuscript/types.ts`
- Modify: `lib/manuscript/migration.ts`
- Modify: `app/pisi/components/workspace-client.tsx`
- Modify: relevant existing manuscript tests

Spremiti čitljivi program lokalno, `unitId` i `profileId` u postojeći manifest
i inicijalne vrijednosti. Stari projekti nastavljaju raditi bez odabira iz
kataloga.

## 4. Provjera

Pokrenuti ciljane testove, zatim `typecheck`, `lint`, `test:ci` i production
build. Ručno provjeriti da izbor fakulteta ponovno filtrira smjer i poništava
zastarjeli profil.
