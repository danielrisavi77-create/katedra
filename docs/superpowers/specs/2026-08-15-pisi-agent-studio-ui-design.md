# `/pisi` Agent Studio UI — Design Specification

## Cilj

`/pisi` treba korisniku pokazati kako Katedra priprema rad, a ne samo otvoriti isti editor kao prije. Glavni ulaz postaje Radionica Katedre: proces agenata, njihove provjere i trenutačni rezultat vidljivi su u jednom radnom prostoru, dok rukopis ostaje stalno dostupan kao lokalni canvas.

## Korisnički doživljaj

- Nakon onboardinga korisnik vidi projektni kontekst i jasan ulaz u Radionicu.
- Korisnik s aktivnim Passom ili admin overrideom ulazi u pripremu agentičnog tijeka bez dodatnog skrivenog koraka.
- Korisnik bez Passa vidi isti procesni prostor u zaključanom/read-only stanju i jasno objašnjenje što otključava Pass.
- Nakon pokretanja runa središnji dio prikazuje vremenski tok: analiza materijala, istraživanje, plan, pisanje po sekcijama i verifikacija.
- Desni stupac prikazuje aktivnu sekciju, outline i sažetak trenutačne verzije rukopisa.
- Generirani rezultat nikada ne mijenja lokalni rukopis bez postojeće korisničke potvrde ili izričito pokrenutog autonomnog načina.

## Informacijska arhitektura

Projektna navigacija dobiva primarnu stavku `Radionica`. `Rukopis` ostaje direktan ulaz u trostupačni editor, a `Literatura`, `Revizija` i `Lekta` ostaju projektni alati.

Radionica koristi postojeće `PaidProjectSetup`, `AgenticDashboard`, `AgenticIntervention` i verifikacijske ugovore. Redizajn ih ne duplicira i ne mijenja server-side entitlement; samo ih čini vidljivim i dostupnim iz glavne navigacije.

## State i kompatibilnost

- Admin status i aktivni Pass i dalje se računaju server-side; admin ne dobiva zasebnu vizualnu aplikaciju.
- `katedra_workspace_view_v1:*` više ne smije vraćati korisnika u stari editor kao zadani ulaz. Uvest će se nova verzija ključa.
- Stari ključ ostaje čitljiv za rollback, ali nova verzija prvi put otvara Radionicu.
- Izravan ulaz u `Rukopis` i postojeće query parametre ostaje podržan.
- Landing, auth, legal, checkout i Lekta handoff ne mijenjaju se.

## Vizualni jezik

- Paper–ink paleta, serifni naslovi i postojeći plavi/žuti akcenti ostaju.
- Procesni događaji izgledaju kao urednički dnevnik, ne kao dashboard s nizom kartica.
- Aktivni agent ima jednu diskretnu animaciju statusa; nema beskonačnog pulsiranja.
- `prefers-reduced-motion` uklanja transformacije i shimmer efekte.
- Na mobitelu Radionica, Rukopis i Katedra ostaju tri glavna konteksta.

## Prihvat

- Existing user s prethodno spremljenim `writing` viewom nakon refresh-a vidi Radionicu.
- Admin račun vidi `Admin pristup`, može otvoriti Radionicu i pokrenuti postojeći agentični tijek.
- Neaktivni Pass vidi zaključanu Radionicu, ne lažno aktivan tijek.
- Klik na `Rukopis` vraća postojeći editor bez gubitka lokalnog sadržaja.
- Process UI jasno prikazuje aktivnog agenta, verifikatora, pokušaj i sljedeću akciju kada run postoji.
- Desktop, tablet, mobile, light i dark mode nemaju horizontalni overflow.
