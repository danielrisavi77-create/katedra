# Research Design Canvas i Methodology Builder

Ova lokalna implementacija uvodi dva stvarna modula u `/pisi` za završne i
diplomske projekte s verificiranim akademskim profilom.

## Granica dostupnosti

- `seminarski` projekti nemaju ove module.
- završni i diplomski projekti trebaju canonical ownership, zaključani projekt,
  aktivni Pass, verified akademski profil i `KATEDRA_RESEARCH_MODULES_ENABLED=true`.
- lokalni potvrđeni admin može pregledati modul bez izmišljanja Stripe Passa.
- produkcija ostaje isključena dok Lekta ugovori i staging E2E ne prođu.

## Što korisnik može napraviti

Research Design Canvas sprema problem, cilj, istraživačko pitanje, hipoteze,
varijable, slučajeve/uzorak i očekivani doprinos. Methodology Builder sprema
dizajn, uzorak, operacionalizaciju, instrument, analizu, ograničenja i etiku.

Plan je local-first u IndexedDB bazi `katedra-research-plans`, vezan uz
canonical `projectId`. Svaka veća promjena može stvoriti snapshot, a statusi
su `Nije započeto`, `Radna verzija`, `Spremno za pregled` i `Odobreno`.

## Privatnost i AI granica

Puni plan ne ulazi u `/api/state` ni u operational logove. Standardni AI prompt
i agent worker dobivaju samo bounded serializer bez ID-jeva, timestampova i
privatnih metapodataka. Workerov payload ostaje privremen i podliježe
postojećem TTL cleanupu.

## Aktivacija

Prije staging aktivacije provjeriti:

1. canonical entitlement i verified profile za testni završni/diplomski projekt;
2. capability endpoint i denial za seminarski/partial/generic profil;
3. lokalni save, reload, review i restore scenario;
4. agent worker payload i cleanup;
5. desktop i 390px layout bez horizontalnog overflowa.

Javni Pass katalog namjerno još ne tvrdi da su ovi moduli dostupni dok svi
staging kriteriji nisu dokazani.
