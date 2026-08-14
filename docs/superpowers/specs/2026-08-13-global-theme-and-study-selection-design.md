# Globalna tema i brži odabir studija

## Cilj

Katedra dobiva jednu dosljednu svijetlu/tamnu temu za landing, autentifikaciju,
račun, pravne stranice i `/pisi`. Prvi prikaz prati `prefers-color-scheme`, a
korisnik može ručno prebaciti temu; njegova odluka pamti se lokalno.

Onboarding u `/pisi` mora automatski potvrditi jedinstveno prepoznatu kraticu
ili puni naziv fakulteta, primjerice `FPZG`, bez dodatnog klika. Nakon potvrde
odmah nudi kraće, čitljive smjerove za odabranu vrstu rada.

## Tema

`ThemeProvider` na klijentu postavlja `data-theme="light"` ili
`data-theme="dark"` na `document.documentElement` prije interakcije korisnika.
Prioritet izbora je:

1. ručno spremljena postavka u localStorageu;
2. postavka uređaja preko `prefers-color-scheme`;
3. svijetla tema ako media query nije dostupan.

Tema koristi zajedničke semantičke tokene za pozadinu, plohu, tintu, prigušeni
tekst, linije, naglaske i sjene. Tamna tema ostaje urednički "papir i tinta"
stil: ugljenasto-plava pozadina, tamne papirnate plohe, topla svijetla tinta te
postojeća plava i žuta kao funkcionalni akcenti. Ne uvodi čistu crnu pozadinu,
neon boje ni zasebne skinove.

Prekidač teme je mala dostupna kontrola sa sunce/mjesec ikonom i tekstualnim
opisom za čitače zaslona. Nalazi se u zajedničkim zaglavljima. Na uskim
prikazima ostaje dostupan bez prekrivanja glavnih akcija.

## Pokrivenost stranica

- `app/katedra-scoped.css`: postojeće landing, auth, account i legal varijable
  mapiraju se na globalne semantic tokene.
- `app/pisi/pisi.css`: lokalni `--pis-*` tokeni dobivaju light/dark vrijednosti
  iz iste semantičke palete.
- `app/globals.css`: globalni scroll-to-top i osnovni dokument dobivaju
  vrijednosti temeljene na temi.

Poslovna logika, autentifikacija, checkout i pravni sadržaj ne mijenjaju se.

## Brži fakultet i smjer

Akademski katalog ostaje `public/katedra-pack.json`. Pri svakom unosu fakulteta
uspoređuje se normalizirani tekst s `unit.id`, nazivom i ustanovom.

- Ako je rezultat jedinstven (`FPZG`), automatski se postavlja `unitId` i
  otvara polje smjera.
- Ako postoji više rezultata, korisnik bira iz prijedloga kao dosad.
- Ručni unos koji nije katalogiziran ostaje moguć i ne dobiva canonical ID.
- Promjenom fakulteta ili vrste rada poništava se prethodni `profileId`.

Popis smjerova filtrira se prema fakultetu i vrsti rada. Stavka prikazuje kraći
naziv smjera, a po potrebi i razlikovnu oznaku, primjerice `Novinarstvo —
tekstualni`. Cijeli canonical profil ostaje spremljen kao `profileId`.

## Testiranje

- unit test prioriteta spremljene, sistemske i fallback teme;
- komponentni test prebacivanja teme i dostupnog naziva kontrole;
- test da točan unos `FPZG` automatski bira fakultet;
- test kraćih FPZG smjerova za završni i diplomski rad;
- regresija za višestruke rezultate i slobodni unos;
- visual/browser provjera light i dark prikaza na reprezentativnim stranicama;
- typecheck, lint, puni testovi i production build.
