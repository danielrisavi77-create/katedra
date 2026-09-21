# Katedra Run Studio — design

## Cilj

Agenticni dio `/pisi` mora korisniku jasno pokazati kako nastaje rad: što je
Katedra napravila, što je verifikator provjerio, koji rezultat čeka odluku i
što će se dogoditi sljedeće.

## Odluke

- Run Studio je novo stanje postojećeg agentičkog workspacea; ne uvodi novu
  paralelnu navigaciju.
- Kanonski run state ostaje Lekta/Supabase ugovor. Katedra zasad projicira
  događaje iz postojećih `steps` i `results`, a budući `events` payload može se
  uključiti bez promjene UI ugovora.
- UI prikazuje provjerljive događaje, izvore, statuse i odluke, ne prikazuje
  skriveno razmišljanje modela.
- Glavni rukopis ostaje lokalna canonical kopija. Rezultat se može prihvatiti
  tek nakon snapshot-a i provjere revision basea.

## Layout

- Gornji dio: stanje runa, aktivna faza, sekcija, pokušaj i sljedeća akcija.
- Središnji dio: kronološki procesni feed s događajima Katedre,
  verifikatora i korisnika.
- Kontekstni dio: aktivna sekcija, izvori i pregled promjene prije prihvata.
- Postojeće kontrole pause/resume/cancel i review ostaju dostupne.

## Događaji

Svaki događaj ima `id`, `actor`, `kind`, `title`, `summary`, `status`, vrijeme,
opcijski `sectionId`, `attempt`, `sources` i `details`. Projekcija mora pokriti
pripremu, čitanje materijala, istraživanje, planiranje, pisanje, verifikaciju,
blokadu, rezultat i korisničku odluku.

## Prihvatni kriteriji

- Aktivni run ima jasno vidljivu poruku što se upravo događa.
- Korisnik može otvoriti detalje događaja bez napuštanja runa.
- Izvor vodi na provjerljivu poveznicu ili jasno pokazuje da nije dostupan.
- Rezultat prije prihvata pokazuje promjenu u odnosu na aktivni rukopis.
- Neuspjeli ili blokirani korak ima objašnjenje i sljedeću radnju.
- Postojeći pause/resume, accept/reject, lokalni snapshot i responsive layout
  ostaju funkcionalni.
