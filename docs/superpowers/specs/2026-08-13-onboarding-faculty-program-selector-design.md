# Odabir fakulteta i smjera u onboardingu

## Cilj

Korak "Rad i fakultet" u `/pisi` mora omogućiti odabir stvarnog fakulteta i
studijskog programa bez gubitka sadašnjeg slobodnog unosa. Korisnik može
upisati puni naziv, dio naziva ili kraticu, primjerice `FPZG`.

## Korisnički tijek

1. Korisnik bira vrstu rada.
2. U pretraživom polju fakulteta unosi naziv ili kraticu.
3. Padajući popis prikazuje odgovarajuće fakultete iz postojećeg
   `katedra-pack.json` kataloga.
4. Nakon odabira fakulteta otvara se pretraživi odabir "Smjer / studij",
   filtriran prema fakultetu i odabranoj vrsti rada.
5. Ako katalog nema ustanovu ili program, korisnik može zadržati vlastiti
   unos. Takav unos nema automatski vezan pravilnik.

## Podaci

`public/katedra-pack.json` ostaje jedini izvor za katalog. Odabrane vrijednosti
spremaju čitljiv naziv fakulteta i programa lokalno te canonical `unitId` i
`profileId` kada postoje. Ne uvodi se database migracija ni server-side
sinkronizacija rukopisa.

## Pristupačnost

Kontrole koriste input s prijedlozima, dostupnim mišem i tipkovnicom. Prazan
upit prikazuje ograničen broj prijedloga, a tipkanje sužava popis bez blokiranja
slobodnog unosa.
