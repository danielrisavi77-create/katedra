# `/pisi` navigacija — editorial command bar

## Cilj

Navigacija `/pisi` treba izgledati kao miran alat za uređivanje rukopisa, a ne kao skup nepovezanih statusa i administrativnih kontrola. Rukopis ostaje glavni fokus, dok navigacija jasno odvaja identitet projekta, trenutni kontekst i pomoćne radnje.

Redizajn obuhvaća desktop gornju traku i mobilni gornji/donji nav. Ne mijenja strukturu triju glavnih radnih područja: sadržaj, rukopis i Katedra.

## Vizualni smjer

Koristi se editorial command bar:

- topla papirnata površina i tanke linije ostaju temelj;
- žuta ostaje identitet Katedre, plava aktivno stanje i primarna akcija;
- nema novih pill navigacija, velikih zaobljenih kartica ni dekorativnih animacija;
- hijerarhija se postiže veličinom teksta, razmakom, poravnanjem i težinom tipografije;
- kontrole imaju mali ili nikakav radius, osim tamo gdje je potreban za pristupačno stanje kontrole;
- light i dark tema koriste iste semantičke uloge boja, s posebno provjerenim kontrastom primarne akcije i aktivne navigacije.

## Desktop gornja traka

Gornja traka visoka je približno 64 px i podijeljena je u tri funkcionalne zone.

### Lijeva zona — identitet

- žuti Katedra znak;
- naziv `Katedra`;
- skraćeni naziv aktivnog projekta/rada;
- cijela zona ostaje poveznica na početnu stranicu;
- dugi naslov rada skraćuje se ellipsisom bez širenja trake.

### Središnja zona — trenutni kontekst

- naziv aktivne sekcije ili poglavlja;
- kompaktni status spremanja s indikatorom i kratkom porukom, primjerice `Spremljeno`;
- status ostaje `role="status"` i `aria-live="polite"`;
- puni tekst lokalne pohrane i sinkronizacije nije stalno vidljiv u glavnoj traci; dostupan je kroz pomoćni opis/tooltip ili projektni izbornik.

### Desna zona — radnje

- broj riječi;
- račun i Pass stanje u postojećem account području;
- globalni light/dark toggle;
- `Projekt` kao sekundarna akcija koja otvara postojeći project drawer;
- `Izvezi DOCX` kao jedina vizualno primarna akcija.

Redoslijed je stabilan na desktopu. Elementi se ne smiju gurati jedan preko drugoga na srednjim širinama; manje važan broj riječi može se sakriti prije nego što se smanji čitljivost glavnih akcija.

## Mobilna navigacija

Na širinama ispod 800 px prikazuje se samo jedan glavni kontekst radnog prostora.

### Mobilni gornji nav

- lijevo: Katedra znak i skraćeni naziv projekta;
- uz identitet: samo kompaktni indikator spremanja;
- desno: tema i jedan projektni/overflow izbornik za `Projekt`, račun, Pass i izvoz;
- puni statusi i sekundarni tekstovi nisu stalno prikazani;
- gornja traka ostaje dovoljno visoka za touch targete i ne zauzima prostor potreban za rukopis.

### Mobilni donji nav

Donji nav ostaje trodijelan:

- `Sadržaj` — struktura i poglavlja;
- `Rukopis` — uređivanje teksta;
- `Katedra` — kontekstualni AI urednik.

Svaka stavka ima kratak inline simbol/ikonu i tekstualnu oznaku. Aktivna stavka koristi plavu boju i diskretan gornji marker, bez teške ispunjene kapsule. Donji nav koristi `env(safe-area-inset-bottom)` i mora ostati upotrebljiv na uređajima s home indicatorom.

## Ponašanje i stanja

- Klik na `Projekt` otvara postojeći project drawer bez promjene aktivnog radnog konteksta.
- Klik na `Izvezi DOCX` poziva postojeći export callback.
- Mobilni overflow izbornik zatvara se klikom izvan njega, Escapeom i izborom akcije.
- Aktivni mobilni kontekst ima `aria-current="page"`.
- Sve kontrole imaju vidljivo `:focus-visible` stanje.
- Hover i otvaranje izbornika koriste kratak prijelaz od približno 180–240 ms.
- `prefers-reduced-motion: reduce` uklanja transformacije i nepotrebne prijelaze.
- Dark mode mora imati čitljiv tekst, vidljivu granicu trake, prepoznatljiv aktivni marker i dovoljan kontrast export gumba.

## Komponente i granice

`WorkspaceShell` ostaje vlasnik layouta i callbackova radnog prostora. Navigacija se razdvaja na manje komponente:

- `WorkspaceBrand` — identitet i naziv projekta;
- `WorkspaceContext` — aktivna sekcija i status spremanja;
- `WorkspaceActions` — desktop radnje;
- `WorkspaceOverflowMenu` — mobilne sekundarne radnje;
- `MobileWorkspaceNav` — tri mobilna konteksta.

Komponente ne smiju duplicirati stanje rukopisa, autha ili Passa. Primaju samo potrebne vrijednosti i callbackove od `WorkspaceShell`/`workspace-client` sloja. Postojeći `ThemeToggle`, account komponenta, project drawer i export tok ostaju canonical implementacije.

## Testiranje

Dodaju se component testovi za:

- prikaz identiteta projekta, aktivne sekcije i statusa spremanja;
- desktop radnje i poziv project drawer/export callbacka;
- otvaranje, zatvaranje i Escape ponašanje mobilnog overflow izbornika;
- aktivno stanje sva tri mobilna konteksta i `aria-current`;
- očuvanje postojeće ThemeToggle i account/Pass funkcionalnosti;
- render bez horizontalnog overflowa u mobilnom layoutu;
- dark mode i reduced-motion selektore kroz postojeći visual contract test.

Postojeći testovi `/pisi`, autha, project drawera, exporta i ThemeTogglea moraju nastaviti prolaziti.

## Kriteriji prihvaćanja

- Desktop nav ima jasne tri zone i ne izgleda kao niz nepovezanih kontrola.
- Samo `Izvezi DOCX` ima primarni vizualni naglasak.
- Status spremanja je vidljiv, ali ne dominira nad radnim prostorom.
- Mobilni header ne prikazuje sve desktop kontrole odjednom.
- Donji mobilni nav jasno pokazuje aktivni kontekst i poštuje safe-area inset.
- Nav je čitljiv u light i dark modu.
- Tipkovnica, Escape, focus-visible i reduced-motion ponašanja su pokrivena testovima.
- Nema promjene u radu outlinea, editora, AI panela, project drawera ili izvoza.

## Izvan opsega

- promjena triju glavnih workspace stupaca;
- promjena modela rukopisa ili IndexedDB pohrane;
- promjena autha, Pass entitlementa ili billing toka;
- nova ikonska biblioteka;
- promjena landinga, auth stranica ili pravnih stranica;
- globalna promjena dizajn tokena izvan `/pisi`.
