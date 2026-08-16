# Katedra Research Notebook i Evidence Ledger

**Status:** odobren dizajn  
**Datum:** 2026-08-16  
**Opseg:** produktni dizajn, korisničko iskustvo, podatkovni model, Research Runtime, sigurnost, privatnost, worker lifecycle i kriteriji prihvaćanja  
**Implementacija:** nije dio ove specifikacije; nakon korisničkog pregleda slijedi zaseban implementation plan

## 1. Cilj

Katedra treba dobiti vlastiti **Research Notebook** i **Evidence Ledger** koji povezuju temu, literaturu, konkretne odlomke izvora, tvrdnje u rukopisu, citate i korisničke odluke u jedan dokaziv akademski workflow.

Sustav ne smije biti samo „chat s PDF-om”. Njegova je glavna vrijednost da za svaku važnu provjerljivu tvrdnju može pokazati:

```text
rukopisna tvrdnja
→ konkretni passage
→ precizni lokator
→ točna verzija izvora
→ procjena kvalitete i prikladnosti
→ odluka korisnika ili odobrenog policyja
→ strukturirani citat
```

Research Notebook služi organiziranju i razumijevanju istraživačkog područja. Evidence Ledger je canonical dokazni sloj koji čuva odnos između tvrdnje i dokaza. Research Runtime izvršava parsiranje, discovery, retrieval i verifikaciju, ali ne smije izravno uređivati rukopis niti samostalno stvoriti konačnu claim-evidence vezu.

## 2. Produktni ishod

Korisnik mora moći:

- učitati vlastite izvore i povezati Zotero;
- dopustiti Katedri da predloži dodatnu literaturu;
- razumjeti glavne teorije, pojmove, autore, metode i znanstvena neslaganja;
- odobriti ili odbaciti pronađene izvore;
- povezati važnu tvrdnju s konkretnim odlomkom izvora;
- vidjeti podržava li izvor tvrdnju izravno, djelomično, ograničavajuće ili joj proturječi;
- umetnuti strukturirani citat bez ručnog prepisivanja bibliografije;
- nastaviti pisati nacrt i kada dokaz još nedostaje;
- spriječiti da poglavlje postane `APPROVED` dok obvezni dokazni problemi nisu riješeni;
- nastaviti raditi dok Research Runtime obrađuje izvore;
- jasno znati što privremeno odlazi u cloud, koliko se dugo čuva i koliko obrada troši;
- kasnije prijeći na autonomnije istraživanje bez migracije na novi projektni ili dokazni model.

## 3. Nepregovorljiva produktna pravila

1. Katedra ostaje procesni, sadržajni i semantički akademski copilot.
2. Lekta ostaje jedini tehnički i document-compliance autoritet za stvarni `.docx`.
3. Research Runtime ne smije izravno mijenjati rukopis.
4. Research Runtime ne smije samostalno stvoriti konačni `claim_evidence_link`.
5. Puni tekst izvora ne smije se trajno čuvati pod izlikom da je samo ekstrahirani tekst ili embeddings indeks.
6. Izvor bez punog teksta može biti bibliografski kandidat, ali ne smije dokazivati tvrdnju.
7. Passage s niskom pouzdanošću ne smije postati verificirani dokaz bez dodatne provjere.
8. Verificirani izvor nije automatski prikladan za svaku tvrdnju.
9. Tvrdnja i dokaz moraju biti vezani uz konkretnu reviziju tvrdnje.
10. Promjena značenja tvrdnje mora moći označiti postojeći dokaz i citat kao `STALE`.
11. Kontradiktorni kvalitetni izvori ne smiju se nevidljivo svesti na jedan „pobjednički” izvor.
12. Svaka automatska odluka mora čuvati policy ID i verziju policyja.
13. Svi canonical identiteti koriste postojeći `auth.users.id` i `academic_projects.id`.
14. Produkcijski DDL i migracije za shared Academic Suite ostaju u Lekta repozitoriju.
15. Lokalni rukopis ostaje canonical sadržajna kopija dok korisnik izričito ne uključi buduću šifriranu cloud biblioteku.

## 4. Release model i prijelaz prema autonomnom istraživanju

### 4.1 MVP način

Prvi javni način rada je:

```text
researchMode = uploaded_plus_suggestions
approvalMode = hybrid
```

Katedra obrađuje korisnikove izvore i predlaže nove izvore s interneta. Sustav automatski provjerava identitet, puni tekst, relevantnost, extraction confidence, kvalitetu i prikladnost za tvrdnju. Očito nevaljani izvori automatski se odbacuju. Konačna lista izvora i sporne claim-evidence veze u MVP-u zahtijevaju korisničku odluku.

### 4.2 Budući autonomni način

Arhitektura od početka podržava:

```text
researchMode = autonomous
approvalMode = policy_automatic
```

U autonomnom načinu isti source, passage, claim, decision i audit modeli ostaju nepromijenjeni. Razlika je samo u tome što strogi `AutoApprovalPolicy` može samostalno odobriti niskorizične slučajeve kada su zadovoljeni svi pragovi, a korisniku poslati samo sporne, kontradiktorne ili visokorizične odluke.

Svaka odluka čuva:

```text
decisionAuthority:
- user
- system_rule
- research_verifier
- auto_approval_policy
- administrator
```

Time se prijelaz iz hibridnog u autonomni način provodi promjenom policyja, ne prepisivanjem proizvoda.

## 5. Informacijska arhitektura i glavni UX

Research Notebook je zaseban puni workspace unutar istog Katedra projekta, dok `/pisi` dobiva kontekstualni Evidence panel.

Predložena projektna navigacija:

```text
Katedra projekt
├── Rukopis
├── Istraživanje
├── Izvori
├── Dokazi
├── Analiza
├── Mentor
├── Obrana
└── Projekt i postavke
```

U prvom releaseu aktivne su cjeline `Rukopis`, `Istraživanje`, `Izvori`, `Dokazi`, `Mentor` i `Projekt i postavke`. `Analiza` i `Obrana` mogu biti označene kao buduće ili beta cjeline dok ne dosegnu vlastiti release gate.

### 5.1 Research Notebook — Pregled

Početni ekran odgovara na četiri pitanja:

1. Što projekt trenutno zna?
2. Što još nedostaje?
3. Što Katedra trenutno obrađuje?
4. Koju odluku korisnik treba donijeti?

Primjer sažetka:

```text
24 izvora
18 odobreno
4 čekaju pregled
2 bez punog teksta

38 prepoznatih tvrdnji
29 podržano
6 traži dokaz
3 sporne tvrdnje

Sljedeći korak:
Pregledaj četiri nova izvora za teorijski okvir.
```

Ne prikazuje se jedan lažni ukupni „readiness score”. Odvojeno se prikazuju pokrivenost literature, pokrivenost tvrdnji, kontradikcije, izvori bez punog teksta i poglavlja koja čekaju Evidence Review.

### 5.2 Danas riješi

Dashboard prikazuje najviše tri prioritetne radnje. Prioritet ovisi o tome blokira li problem poglavlje, koliko tvrdnji ovisi o njemu, koliko je blizu rok i može li se jednom odlukom riješiti više problema.

### 5.3 Research coverage

Prikazuje se pokrivenost po poglavljima:

```text
1. Uvod                         dovoljno pokriveno
2. Teorijski okvir              dvije rupe
3. Pregled istraživanja         jedna kontradikcija
4. Metodologija                 spremno
5. Rezultati                    čeka analizu
6. Rasprava                     nije započeto
```

Klik vodi na povezane izvore, tvrdnje i research zadatke.

### 5.4 Research Landscape

Research Landscape je verzionirani artefakt koji prikazuje:

- ključne pojmove i sinonime;
- glavne autore i teorijske perspektive;
- metodološke tradicije;
- relevantni institucijski i lokalni kontekst;
- važne znanstvene rasprave;
- nedovoljno pokrivena područja;
- preporučene smjerove pretraživanja.

Korisnik vidi diff između verzija i može odobriti novu verziju, zatražiti izmjene ili zadržati postojeću. Structure i planning agenti smiju koristiti samo `APPROVED` Landscape artefakt.

### 5.5 Izvori

Biblioteka izvora prikazuje naslov, autore, godinu, vrstu, dostupnost punog teksta, identity status, relevantnost, korištenje u rukopisu i approval status.

Filteri uključuju:

- odobrene izvore;
- izvore koji čekaju pregled;
- izvore bez punog teksta;
- korištene i neiskorištene izvore;
- kontradiktorne izvore;
- službene izvore;
- znanstvene članke;
- hrvatske izvore;
- novije izvore;
- povučene ili problematične izvore.

Odbacivanje izvora prije potvrde prikazuje posljedice za tvrdnje, citate i poglavlja.

### 5.6 Tvrdnje i dokazi

Evidence Ledger ima tri glavna prikaza:

- po tvrdnjama;
- po izvorima;
- po problemima.

Problem view uključuje tvrdnje bez dokaza, djelomično podržane tvrdnje, previše snažne formulacije, zastarjele dokaze, kontradikcije, draft citatione, stale citatione i passagee niske pouzdanosti.

### 5.7 Research zadaci

Korisniku se prikazuju razumljivi zadaci, ne tehnički queue:

```text
Početno mapiranje literature
Pronađi hrvatske izvore o participaciji mladih
Provjeri uzročnu tvrdnju u poglavlju 2.3
Pronađi puni tekst rada Smith 2022.
```

Detalj zadatka prikazuje razlog, povezanu tvrdnju ili poglavlje, plan pretrage, izvore koje će Katedra koristiti, adversarial search, privacy posljedice, procijenjeni raspon troška i otvorene odluke.

### 5.8 Odluke

`Odluke` je inbox situacija koje MVP ne smije riješiti bez korisnika:

- izvori za odobrenje;
- identity conflicts;
- OCR i extraction review;
- kontradiktorni dokazi;
- slabiji lokalni izvor;
- sekundarni umjesto primarnog izvora;
- interpretativne odluke;
- promjene Research Landscapea.

Svaka odluka mora sadržavati razumljivo objašnjenje i preporučenu radnju, ne samo error kod.

### 5.9 Povijest

Standardni audit prikaz je ljudski razumljiv. Napredni prikaz može sadržavati request ID, provider, model, processor version, hash, policy version i cost units, ali puni tekst rukopisa i izvora ne ulazi u tehničke logove.

## 6. Integracija s `/pisi` i Evidence panel

Research Notebook ostaje puni istraživački workspace. U editoru se pojavljuje kontekstualni Evidence panel koji odgovara na pet pitanja:

1. Je li označeni sadržaj provjerljiva tvrdnja?
2. Ima li odgovarajući dokaz?
3. Podržava li dokaz stvarno trenutačnu formulaciju?
4. Treba li strukturirani citat?
5. Postoji li relevantan suprotan ili ograničavajući dokaz?

Panel ima kartice:

```text
Pregled
Dokazi
Pretraga
Citat
Audit trail
```

Glavne radnje:

```text
[Poveži dokaz]
[Pronađi novi izvor]
[Preformuliraj tvrdnju]
[Otvori puni Research Notebook]
```

Dokazi se grupiraju kao `PODRŽAVA`, `OGRANIČAVA`, `PROTURJEČI` i `KONTEKST`.

Na desktopu se panel otvara uz editor. Na mobilnom uređaju otvara se kao full-screen sheet koji vraća focus na izvornu tvrdnju nakon zatvaranja.

## 7. Analiza tvrdnji tijekom pisanja

Katedra koristi hibridni model.

### 7.1 Lokalni lagani classifier

Nakon kratke pauze u tipkanju lokalni classifier označava moguće:

- empirijske tvrdnje;
- brojke, datume i postotke;
- definicije;
- pravne i institucijske tvrdnje;
- uzročne formulacije;
- teorijske atribucije;
- vlastite interpretacije;
- prijelazne rečenice bez obveze vanjskog dokaza.

Ovaj korak ne pretražuje internet, ne šalje rukopis vanjskom modelu i ne troši AI budžet.

### 7.2 Dublja analiza

Research Runtime se uključuje kada korisnik:

- završi odlomak;
- spremi veću izmjenu;
- umetne ili promijeni citat;
- zatraži provjeru označenog teksta;
- pokrene Evidence Review;
- pokuša označiti poglavlje kao završeno.

### 7.3 Obvezni section-level audit

Prije statusa `APPROVED` provjerava se:

- jesu li sve obvezne tvrdnje prepoznate;
- imaju li odgovarajući dokaz;
- podržava li passage formulaciju;
- postoje li citati bez dokazne funkcije;
- jesu li lokatori točni;
- je li korelacija pogrešno predstavljena kao uzročnost;
- postoje li zanemareni suprotni nalazi;
- odgovaraju li brojke reproducibilnoj analizi;
- je li nakon uređivanja neki dokaz postao stale.

## 8. Claim Classification Engine

Svaka relevantna tvrdnja dobiva jednu od obveza:

```text
EVIDENCE_REQUIRED
EVIDENCE_RECOMMENDED
NO_EXTERNAL_EVIDENCE_REQUIRED
```

Dokaz je u pravilu obvezan za:

- empirijske i statističke tvrdnje;
- definicije preuzete iz literature;
- povijesne činjenice;
- pravne i institucijske tvrdnje;
- opis tuđih teorija i nalaza;
- uzročne tvrdnje;
- usporedbe država, skupina i razdoblja;
- precizne brojke, datume i postotke;
- tvrdnje poput „istraživanja pokazuju”.

Dokaz može biti preporučen za sinteze, interpretacije i argumentacijske zaključke koji proizlaze iz već povezanih dokaza.

Vanjski izvor nije nužan za organizacijske rečenice, opis vlastitog postupka, prijelaze i jasno označenu autorovu argumentaciju. Vlastita statistička analiza koristi `AnalysisResultObject`, a ne bibliografski izvor.

Statusi tvrdnje:

```text
DRAFT
MISSING_EVIDENCE
EVIDENCE_ATTACHED
PARTIALLY_SUPPORTED
SUPPORTED
CONTRADICTED
OVERSTATED
STALE
APPROVED
BLOCKED
```

## 9. Status poglavlja i blockeri

Korisnik može nastaviti pisati nacrt i koristiti privremene oznake poput `[POTREBAN IZVOR]`. Pisanje se ne blokira tijekom kreativnog rada.

Status poglavlja:

```text
DRAFT
→ EVIDENCE_REVIEW
→ BLOCKED ili NEEDS_DECISION
→ APPROVED
→ READY_FOR_EXPORT
→ READY_FOR_LEKTA
```

Nezaobilazni blockeri uključuju:

- nepostojeći ili neprovjerljiv izvor;
- DOI, naslov ili autori koji ne odgovaraju dokumentu;
- korištenje izvora bez punog teksta kao dokaza;
- passage koji ne podržava tvrdnju;
- nepostojeći lokator;
- brojku koja ne odgovara reproduciranoj analizi;
- povučeni rad prikazan kao važeći dokaz;
- tvrdnju pogrešno pripisanu autoru;
- moguću fabrikaciju izvora ili podataka.

Interpretativna pitanja prelaze u `NEEDS_DECISION`. Korisnik može potvrditi odluku uz kratko obrazloženje koje ostaje u audit trailu.

`READY_FOR_LEKTA` znači samo da je sadržajni i dokazni sloj Katedre prošao svoje gateove. Ne znači da je stvarni Word dokument tehnički usklađen.

## 10. Životni ciklus izvora

Osnovni lifecycle:

```text
DISCOVERED
→ IDENTITY_VERIFIED
→ CONTENT_AVAILABLE
→ PASSAGE_VERIFIED
→ CLAIM_SUPPORTED
→ APPROVED_FOR_PROJECT
→ USED_IN_MANUSCRIPT
```

Izvor bez punog teksta završava u:

```text
IDENTITY_VERIFIED
→ FULL_TEXT_MISSING
→ AWAITING_USER_DOCUMENT
```

Takav izvor smije imati bibliografske podatke i objašnjenje relevantnosti, ali ne smije podržavati tvrdnju, navoditi neprovjerenu stranicu ili ući u odobrenu verziju rukopisa kao verificirani dokaz.

## 11. Kontekstualni model kvalitete izvora

Katedra odvojeno procjenjuje:

```text
SOURCE INTEGRITY
Koliko je pouzdano da je izvor stvaran, cjelovit i vjerodostojan?

CLAIM FITNESS
Koliko je izvor prikladan upravo za konkretnu tvrdnju?
```

Za službenu statistiku prioritet imaju službene statističke institucije. Za pravnu tvrdnju prioritet ima važeći službeni propis. Za teorijsku tvrdnju prioritet imaju izvorni autor i relevantna znanstvena literatura. Za aktualni događaj prioritet imaju primarni dokument i vjerodostojni sekundarni izvori.

Kontekstualna procjena može uključivati:

- identitet i autentičnost;
- recenziranost;
- vrstu istraživačkog dizajna;
- metodološku transparentnost;
- veličinu i karakteristike uzorka;
- retraction ili correction status;
- vremensku aktualnost;
- jurisdikciju;
- populacijsku i metodološku prikladnost;
- izravnost potpore;
- dostupnost primarnog izvora.

Automatski se blokiraju krivotvoreni ili neprovjerljivi izvori, DOI mismatch, passage koji ne podržava tvrdnju, neprikladna jurisdikcija, nepostojeći lokator i povučeni rad korišten bez odgovarajuće napomene.

## 12. Kontradiktorni dokazi

Kada se kvalitetni izvori ne slažu, Katedra stvara `ContestedEvidenceBundle`.

Bundle uključuje:

- izvore koji podržavaju tvrdnju;
- izvore koji je ograničavaju;
- izvore koji joj proturječe;
- usporedbu populacija, razdoblja, definicija, uzoraka, metoda i jurisdikcija;
- procjenu radi li se o stvarnoj kontradikciji ili različitim istraživačkim pitanjima;
- prijedlog uravnotežene formulacije;
- korisničku odluku i obrazloženje.

Katedra ne smije prikriti relevantne suprotne nalaze radi jednostavnijeg teksta.

## 13. Strategija istraživanja

### 13.1 Landscape Research

Na početku projekta Katedra mapira:

- ključne pojmove i sinonime;
- glavne autore i teorije;
- metodološke tradicije;
- znanstvena neslaganja;
- lokalne praznine;
- preporučene smjerove pretraživanja.

Rezultat je verzionirani `ResearchLandscapeArtifactV1`.

### 13.2 Claim-Driven Research

Tijekom pisanja research zadaci nastaju na okidače:

```text
MISSING_EVIDENCE
WEAK_EVIDENCE
SECONDARY_ONLY
OUTDATED_EVIDENCE
CONTESTED_EVIDENCE
LOW_SOURCE_DIVERSITY
MISSING_LOCAL_CONTEXT
OVERSTATED_CLAIM
```

Research zadatak mora imati precizan cilj, traženu vrstu izvora, vremenski i geografski opseg te kriterij završetka.

### 13.3 Federirano pretraživanje

`SourceQueryPlanner` prvo klasificira što se traži, a zatim bira kanale:

- akademske baze i repozitoriji za znanstvene tvrdnje;
- službene statističke institucije za brojke;
- službena glasila i institucije za pravne tvrdnje;
- fakultetske stranice i objavljeni dokumenti za procedure;
- primarni dokumenti i vjerodostojni mediji za aktualne događaje;
- hrvatski repozitoriji i institucije za lokalni kontekst;
- korisnikova biblioteka i Zotero za postojeće izvore;
- zasebna adversarial pretraga za suprotne i ograničavajuće nalaze.

Svaki discovery adapter implementira zajednički ugovor i vraća normalizirane kandidate.

### 13.4 Legal-access model

Katedra automatski dohvaća samo:

- open-access sadržaj;
- službene javne dokumente;
- sadržaj dostupan dopuštenim API-jem ili licencom;
- dokument koji je korisnik osobno učitao.

Katedra ne zaobilazi paywall, ne traži knjižnične lozinke i ne koristi korisničku sesiju bez eksplicitne radnje. Paywalled izvor ostaje `FULL_TEXT_MISSING`, a korisnik ga može legalno pribaviti i učitati.

## 14. Podržani formati i ingestion

### 14.1 Produkcijski podržano u prvom releaseu

- digitalni PDF;
- DOCX;
- javni web URL;
- Zotero zapis, kolekcija i privitak;
- TXT i Markdown;
- CSV i XLSX.

### 14.2 Beta adapteri

- skenirani PDF;
- slike i rukopis;
- PPTX;
- EPUB;
- audio i video;
- `.omv`;
- SPSS, Stata i R formati;
- složene formule, grafikoni i tablice.

Adapter statusi:

```text
SUPPORTED
BETA
EXPERIMENTAL
```

### 14.3 Jedinstveni ingestion pipeline

```text
ulaz
→ sigurnosna i formatna validacija
→ specijalizirani adapter
→ ekstrakcija sadržaja i strukture
→ procjena kvalitete ekstrakcije
→ normalizacija u AcademicDocumentV1
→ metadata i identity verification
→ passage segmentation
→ Evidence Ledger kandidati
```

Candidate engines uključuju Docling za opću dokumentnu strukturu, GROBID za znanstvene metapodatke i reference, PaperQA2 ili ekvivalentni retrieval sloj, Zotero adapter i CSL engine. Nijedan vanjski projekt nije canonical authority; svi rade iza Katedrinih adaptera i contracta.

### 14.4 Evidence locator

Lokator ne pretpostavlja da svaki izvor ima stranicu. Podržava:

- PDF stranicu, heading path i bounding box;
- paragraph ID;
- tablicu, red i stupac;
- spreadsheet sheet i range;
- web URL, heading i text anchor;
- audio/video timestamp i speaker/frame;
- pravni članak, stavak, točku i verziju dokumenta.

### 14.5 Granularni confidence gate

Pouzdanost se dodjeljuje svakom odlomku, tablici, ćeliji, formuli ili audiosegmentu:

```text
HIGH_CONFIDENCE
MEDIUM_CONFIDENCE
LOW_CONFIDENCE / NEEDS_REVIEW
BLOCKED
```

Srednja pouzdanost pokreće dodatni parser, OCR ili neovisnu provjeru. Niska pouzdanost ne smije dokazivati tvrdnju dok korisnik ne potvrdi ili ispravi sadržaj. Confidence uvijek mora sadržavati razlog, ne samo postotak.

## 15. Strukturirani citati

Katedra u rukopis ne umeće samo običan tekst `(Autor, godina)`, nego strukturirani citation mark vezan uz:

- `claimId`;
- konkretnu reviziju tvrdnje;
- `sourceId` i `sourceVersionId`;
- jedan ili više `passageId` zapisa;
- intent citata;
- display mode;
- citation style;
- prikazani lokator;
- verification status;
- lokalni rukopisni anchor.

Podržani intenti:

```text
direct_quote
paraphrase
data
definition
legal_reference
background
```

Podržani display načini:

```text
parenthetical
narrative
footnote
endnote
```

Interni Evidence Locator uvijek ostaje precizan čak i kada odabrani stil ne prikazuje stranicu. Izravni citat zahtijeva precizan prikazani lokator.

Draft citat dopušten je u nacrtu, ali ne može učiniti tvrdnju `SUPPORTED` ni poglavlje `APPROVED`.

Bibliografija se automatski održava iz verificiranih metapodataka i CSL stila. Promjena stila mijenja prikaz, ne underlying evidence veze.

## 16. Privatnost, pohrana i retention

Sustav ima četiri jasno odvojena podatkovna sloja.

### 16.1 Lokalni canonical sadržaj

Na uređaju ostaju:

- puni rukopis;
- točan tekst tvrdnji;
- originalni lokalni izvori;
- puni ekstrahirani tekst gdje je dostupan lokalno;
- lokalni embeddingsi;
- rukopisni anchor i pozicije;
- radne bilješke i verzije.

### 16.2 Privremeni Research Runtime storage

Za naprednu obradu korisnik može eksplicitno dopustiti privremeni upload.

- zadani TTL: 72 sata;
- apsolutni maksimum: 7 dana samo za aktivan workflow;
- korisnik može ranije obrisati payload;
- payload je privatno i projektno izoliran;
- originalni dokument, OCR, transcript, puni extraction i embeddings brišu se po isteku.

### 16.3 Trajni minimalni Evidence Ledger

Nakon brisanja punog izvora ostaju samo:

- bibliografski identitet;
- vanjski identifikatori;
- hash dokumenta i verzije;
- kratki nužni passage;
- precizni lokator;
- claim fingerprint;
- claim-passage-source odnos;
- procjene kvalitete;
- decision i audit metadata.

Brišu se puni tekst, nekorišteni odlomci, OCR rezultat, transcript i embeddings indeks cijelog dokumenta.

### 16.4 Buduća šifrirana biblioteka

`Encrypted Research Library` može se kasnije ponuditi kao zaseban opt-in za cross-device rad. Ne smije biti nevidljiva promjena osnovnog privacy modela.

## 17. Canonical podatkovni model

### 17.1 Projektni identitet

Postojeći identiteti ostaju canonical:

```text
auth.users.id
academic_projects.id
```

Ne stvara se novi paralelni project model.

### 17.2 Glavni entiteti

Predložene canonical cjeline:

```text
research_notebooks
research_sources
source_external_identifiers
research_source_versions
temporary_research_payloads
evidence_passages
manuscript_claims
claim_revisions
claim_evidence_links
source_integrity_assessments
claim_fitness_assessments
research_landscape_artifacts
research_tasks
source_query_plans
evidence_proposals
contested_evidence_bundles
manuscript_citations
research_decisions
research_audit_events
research_processing_runs
research_jobs
research_job_dependencies
research_dispatch_outbox
```

### 17.3 Ključni odnosi

```text
academic_project
└── research_notebook
    ├── research_sources
    │   └── source_versions
    │       └── evidence_passages
    │
    ├── research_landscape_artifacts
    ├── research_tasks
    │   ├── source_query_plans
    │   └── evidence_proposals
    │
    ├── manuscript_claims
    │   └── claim_revisions
    │       ├── claim_evidence_links
    │       └── manuscript_citations
    │
    ├── contested_evidence_bundles
    ├── research_decisions
    ├── processing_runs
    └── audit_events
```

### 17.4 Claim revision integritet

`claim_evidence_link` mora sadržavati `verifiedAgainstClaimRevisionId`. Ako se trenutačna claim revizija razlikuje od verificirane revizije, link postaje kandidat za `STALE`.

### 17.5 Source versioning

Preprint, accepted manuscript, published verzija, correction, službena revizija i web snapshot ne prepisuju jedan drugoga. Svaka verzija ima vlastiti hash, metadata snapshot, adapter version i extraction status.

### 17.6 Evidence proposal granica

Research Runtime vraća `EvidenceProposalV1`. Tek Katedra Research Gateway nakon validacije i approvala stvara canonical `claim_evidence_link`.

### 17.7 Integritetni uvjeti

Sustav ne smije dopustiti:

1. verificirani evidence link prema neprovjerenom izvoru;
2. verificirani link prema low-confidence ili blocked passageu;
3. finalni citat bez source i passage veze;
4. izravni citat bez preciznog lokatora;
5. `SUPPORTED` claim verificiran samo protiv stare revizije;
6. `APPROVED` poglavlje s blokiranim obveznim tvrdnjama;
7. auto-approval bez policy verzije;
8. nevidljivo mijenjanje korisničke odluke;
9. prepisivanje stare source verzije novom;
10. brisanje odbačenog dokaza iz audit traila kao da nije postojao;
11. trajno spremanje punog dokumenta kao „ekstrahiranog teksta”;
12. izravno uređivanje rukopisa iz Research Runtimea.

## 18. Fizička arhitektura i granice repozitorija

Preporučene cjeline:

```text
KATEDRA REPO
Korisničko sučelje, lokalni rukopis i Research Gateway consumer

LEKTA REPO
Canonical Academic Suite schema, RLS, migracije i atomic RPC-i

KATEDRA RESEARCH RUNTIME REPO
Python API, parseri, discovery, retrieval, verification i workeri
```

Predloženi naziv novog repozitorija:

```text
danielrisavi77-create/katedra-research-runtime
```

### 18.1 Katedra repo

Sadrži:

- Research Notebook UI;
- Evidence panel u `/pisi`;
- source approval i decision UX;
- strukturirane citate;
- lokalni claim anchor model;
- TypeScript contract klijente;
- auth, ownership, Pass i budget provjere;
- pokretanje, pauziranje i otkazivanje research taskova;
- Research Gateway validaciju i canonical commit flow.

### 18.2 Lekta repo

Sadrži:

- Evidence Ledger migracije;
- RLS i ownership pravila;
- atomic RPC-e;
- storage lifecycle i cleanup pravila;
- canonical table i transition invariants;
- cross-product schema testove.

### 18.3 Research Runtime

Preporučena struktura:

```text
runtime/
├── api/
├── ingestion/
├── discovery/
├── fulltext/
├── verification/
├── landscape/
├── contradiction/
├── workers/
├── contracts/
└── tests/
```

Research Runtime može koristiti Python, FastAPI i Pydantic, ali concrete framework nije korisnički contract i može se promijeniti bez promjene Katedra UX-a.

### 18.4 Zajednički contracti

Canonical JSON Schema/OpenAPI contracti definiraju:

```text
AcademicDocumentV1
ResearchTaskV1
ResearchLandscapeArtifactV1
EvidenceProposalV1
EvidenceLocatorV1
ClaimEvidenceBundleV1
ProcessingResultV1
```

Iz njih se generiraju TypeScript tipovi i Python Pydantic modeli. Svaki payload nosi `schemaVersion`, `contractHash`, `producer` i `producerVersion`. Nepoznata verzija fail-closeda.

## 19. Queue i worker lifecycle

### 19.1 Authority model

Canonical Supabase stanje ostaje izvor istine. Queue nije authority.

Preporučeni model:

```text
canonical database
+ transactional outbox
+ dispatcher
+ capability-signed Research Runtime job
+ Research Gateway commit authority
```

### 19.2 Research task kao DAG

Visokorazinski task dijeli se na idempotentne jobove, primjerice:

```text
validate_asset
scan_asset
extract_document
resolve_identity
resolve_full_text
segment_passages
assess_source
build_landscape
discover_sources
retrieve_evidence
verify_claim_support
scan_contradictions
build_evidence_proposal
cleanup_payloads
```

Različiti izvori mogu se obrađivati paralelno. Ovisnosti za isti izvor ostaju eksplicitne u `research_job_dependencies`.

### 19.3 Transactional outbox

Odobravanje research taska u jednoj transakciji:

1. stvara task;
2. stvara početne jobove;
3. rezervira dopušteni budžet;
4. stvara outbox event.

Ako bilo koji korak ne uspije, ništa se ne dispatcha.

### 19.4 Idempotency

Job ima deterministički idempotency key izveden iz projekta, taska, inputa, job typea i processor versiona. Ponovljeni dispatch ili callback ne smije stvoriti novi rezultat ni dvostruku naplatu.

### 19.5 Capability token

Research Runtime ne dobiva service-role ključ ni browser sesiju. Za svaki posao dobiva kratkotrajni token ograničen na:

- jedan `jobId`;
- jedan `taskId`;
- jedan `projectId`;
- dopuštene operacije;
- točne signed input/output objekte;
- maksimalni input, output i cost;
- contract hash;
- jedinstveni `jti` i rok važenja.

### 19.6 Worker lifecycle

```text
preflight
→ dispatch
→ token i contract validacija
→ lease
→ running + heartbeat
→ izolirano izvršavanje
→ temporary output
→ Research Gateway validation
→ canonical proposal commit
→ cleanup
```

Worker nema pravo izravno stvoriti evidence link ni uređivati rukopis.

### 19.7 Pause i cancel

Pause zaustavlja dispatch novih jobova; trenutačni atomarni posao smije završiti do checkpointa. Cancel opoziva nove tokenе, traži otkaz aktivnog posla, cleanup-a temporary payloadove i ignorira kasni rezultat kao `LATE_RESULT_IGNORED`.

### 19.8 User intervention

Stanja poput `FULL_TEXT_MISSING`, `IDENTITY_CONFLICT`, `OCR_REVIEW_REQUIRED`, `PASSWORD_PROTECTED_DOCUMENT` i `CONTROVERSIAL_INTERPRETATION` prelaze u `AWAITING_USER`, ne u generički failure.

## 20. Greške, retry i reconciliation

Error taxonomy:

```text
TRANSIENT
USER_ACTION_REQUIRED
PERMANENT_INPUT
POLICY_BLOCK
CONTRACT_OR_INTEGRITY
```

Automatski retry koristi exponential backoff i jitter samo za transient greške. Corrupt input, identity conflict i full-text missing ne retryaju se naslijepo.

Parser fallback ne smije sniziti confidence standard. Fallback output prolazi isti gate.

Task podržava partial success:

```text
COMPLETED
COMPLETED_WITH_WARNINGS
AWAITING_USER
BLOCKED
FAILED
CANCELLED
```

Reconciliation uspoređuje job stanje, outbox, lease, heartbeat, runtime ACK, payload TTL, budget reservation i rezultate bez commita. Može redispatchati izgubljeni lease, otpustiti orphaned budžet, cleanupati payload bez živog joba i ignorirati callback za otkazani job.

## 21. Sigurnost

### 21.1 Izolirani workeri

- Document worker nema slobodan web pristup.
- Discovery worker ima kontrolirani egress i ne dobiva puni rukopis.
- Verification worker dobiva samo nužni claim i passage kontekst.
- OCR/vision worker obrađuje samo eksplicitno dopuštene stranice ili slike.
- Budući Analysis worker koristi izolirani Python/R environment bez produkcijskih tajni.

### 21.2 SSRF zaštita

Discovery fetch sloj mora blokirati localhost, privatne IP raspone, interne protokole, DNS rebinding i nekontrolirane redirecte. Ograničava response size, content type i broj redirecta.

### 21.3 Maliciozni dokumenti

Prije parsera obvezni su:

- magic-byte i MIME provjera;
- antivirus scan;
- archive/decompression bomb zaštita;
- maksimalan broj archive zapisa;
- odbijanje nepodržane enkripcije;
- zabrana izvršavanja makronaredbi;
- sandboxirani parser;
- input, CPU, RAM, disk i time limit.

### 21.4 Prompt injection

Sav source sadržaj označava se kao `UNTRUSTED_SOURCE_CONTENT`. Dokument ne smije mijenjati system prompt, birati alate, povećati budžet, dodavati URL na allowlistu, odobriti vlastiti izvor ili uređivati rukopis.

### 21.5 Logovi

Logovi smiju sadržavati ID-eve, hash, veličinu, processor version, trajanje, status, error code i cost. Ne smiju automatski sadržavati puni passage, rukopis, OCR, source PDF, mentorove bilješke ili osobne podatke.

## 22. Permission i onboarding model

Onboarding se pokreće kada korisnik prvi put otvori Istraživanje, učita izvor, poveže Zotero, zatraži web research ili pokrene Evidence Review koji zahtijeva Runtime.

Onboarding mora objasniti:

- što Katedra može učiniti;
- da novi izvor ne ulazi automatski u rukopis;
- odabir početnog izvora;
- research mode;
- lokalnu i privremenu obradu;
- provider kategorije;
- trošak i budget policy;
- točan plan obrade prije pokretanja.

Dozvole su odvojene:

```text
temporary_document_processing
web_source_discovery
external_metadata_lookup
llm_claim_verification
ocr_or_vision_processing
audio_transcription
zotero_read
zotero_write
encrypted_cloud_library
```

Svaka dozvola čuva status, datum, opseg, provider policy, retention policy i authority. Opozivanje zaustavlja nove jobove, otkazuje aktivni posao gdje je moguće, opoziva signed capabilityje i cleanup-a payloadove bez gubitka lokalnog rukopisa.

Osjetljive radnje koriste just-in-time permission, primjerice slanje skeniranih stranica vision provideru ili zapis u Zotero kolekciju.

## 23. Budget i observability

Prije naplativog research taska korisnik vidi:

- što će sustav napraviti;
- koje skupe korake uključuje;
- procijenjeni raspon research jedinica;
- privacy posljedice;
- što se događa pri otkazivanju.

Interni billing koristi:

```text
userId
projectId
taskId
jobId
requestId
idempotencyKey
provider
model
estimatedCost
actualCost
```

Svaka naplativa radnja koristi `reserve → execute → settle actual → release unused`.

Operativni dashboard prati:

- queue depth i najstariji job;
- trajanje po job typeu;
- retry i dead-letter stopu;
- broj `AWAITING_USER` zadataka;
- cost po provideru i processoru;
- full-text availability;
- identity conflict stopu;
- source proposal acceptance rate;
- stale claimove;
- orphaned payloadove i cleanup kašnjenje.

`Evidence proposal acceptance rate` je ključan quality signal. Tehnički uspješan worker nije dovoljno dobar ako korisnici često odbijaju njegove prijedloge.

## 24. Accessibility i mobilno iskustvo

Obvezno:

- status se ne prenosi samo bojom;
- cijeli flow radi tipkovnicom;
- focus se vraća na izvornu tvrdnju;
- screen reader dobiva statusne promjene;
- passage comparison ima linearni prikaz;
- reduced motion uklanja dekorativne animacije;
- confidence ima tekstualno objašnjenje;
- mobile sheetovi imaju focus trap;
- tablice imaju list alternativu;
- kompleksni Contested Evidence pregled može se otvoriti u punom Notebooku.

Mobilna navigacija:

```text
Pregled
Izvori
Dokazi
Zadaci
```

## 25. Testna strategija

### 25.1 Unit testovi

- svi dopušteni i nedopušteni statusni prijelazi;
- claim classification;
- stale detection;
- evidence requirement pravila;
- source lifecycle;
- confidence gate;
- citation mark validacija;
- policy decision authority;
- idempotency key;
- retry classification;
- partial success agregacija.

### 25.2 Contract testovi

Isti fixture payloadovi prolaze kroz:

- JSON Schema;
- generirane TypeScript tipove;
- Python Pydantic modele;
- Research Gateway validator.

### 25.3 Fault injection

Obvezni scenariji:

- isti job dispatchan dvaput;
- worker padne nakon provider poziva;
- callback se izgubi;
- heartbeat prestane;
- token istekne ili se ponovno koristi;
- rezultat referencira drugi projekt;
- korisnik otkaže posao prije commita;
- signed URL istekne;
- output hash ne odgovara;
- budget settlement padne nakon obrade;
- outbox event ostane zaključan;
- rezultat stigne nakon otkazivanja.

### 25.4 Sigurnosni testovi

- SSRF prema localhostu;
- DNS rebinding;
- archive bomb;
- lažni MIME;
- maliciozni PDF;
- prompt injection u dokumentu;
- cross-project storage path;
- output limit;
- token replay;
- pokušaj workera da stvori evidence link;
- low-confidence passage prikazan kao verificiran.

### 25.5 Golden Research Projects

Najmanje:

- znanstveni pregled literature;
- pravno-institucijski projekt;
- službena statistika;
- hrvatski lokalni kontekst;
- kontradiktorna literatura;
- lažni DOI i fabrikirani izvor;
- paywalled izvor;
- skenirani dokument;
- dokument s prompt injectionom;
- dataset povezan s tvrdnjama.

### 25.6 Staging E2E

```text
projekt
→ onboarding i permission
→ upload
→ temporary payload
→ outbox dispatch
→ worker
→ heartbeat
→ extraction
→ identity verification
→ passage
→ EvidenceProposal
→ korisnički approval
→ claim-evidence link
→ citation insert
→ claim edit
→ stale detection
→ Evidence Review
→ approval gate
→ export handoff
```

Bez punog E2E toka modul nije production-ready.

## 26. Kriteriji prihvaćanja

Dizajn je implementiran kada korisnik može:

1. otvoriti Research Notebook unutar postojećeg projekta;
2. razumjeti privacy, retention i trošak prije obrade;
3. učitati produkcijski podržane formate i povezati Zotero;
4. nastaviti raditi dok se izvori obrađuju;
5. dobiti verzionirani Research Landscape;
6. odobriti ili odbaciti source kandidate;
7. vidjeti zašto je source identity potvrđen ili blokiran;
8. povezati claim s konkretnim passageom i locatorom;
9. vidjeti supports, limits, contradicts i contextualizes odnose;
10. dobiti Contested Evidence Bundle za relevantna neslaganja;
11. umetnuti strukturirani citat i automatski održavati bibliografiju;
12. dobiti stale upozorenje nakon semantičke promjene tvrdnje;
13. nastaviti pisati nacrt s neriješenim problemima;
14. spriječiti `APPROVED` status dok postoje blockeri;
15. opozvati permission bez gubitka lokalnog rukopisa;
16. pauzirati ili otkazati task bez dvostruke naplate;
17. ponovno učitati isti dokument i povezati ga prema hashu;
18. izvesti projekt bez obveznog uključivanja autonomnih funkcija;
19. poslati sadržajno odobren snapshot prema WordReplici i zatim Lekti;
20. dobiti audit trag bez trajnog spremanja punog rukopisa ili izvora.

## 27. Predloženi release rezovi

Ovo nije implementation plan, nego granica funkcionalnih releasea.

### Release A — Evidence Core

- canonical contracti;
- source, version, passage, claim i decision modeli;
- lokalni claim anchor;
- ručno povezivanje postojećeg izvora s tvrdnjom;
- strukturirani citat;
- Evidence Review gate;
- privacy i audit invarianti.

### Release B — Production ingestion

- digitalni PDF, DOCX, URL, Zotero, TXT/MD, CSV/XLSX;
- identity verification;
- passage segmentation;
- granularni confidence;
- temporary storage i cleanup;
- source library UX.

### Release C — Suggested research

- Landscape Research;
- federirani discovery;
- legal full-text resolver;
- claim-driven i adversarial research;
- EvidenceProposal approval flow;
- Contested Evidence Bundle.

### Release D — Autonomous-ready operations

- transactional outbox;
- capability-signed workers;
- distributed budget reservation;
- reconciliation;
- policy-versioned auto-approval infrastructure;
- Golden Research quality gates.

### Release E — Napredni adapteri i proširenja

- OCR/vision;
- audio/video;
- `.omv`, SPSS, Stata i R formati;
- Jupyter/jamovi/Quarto Analysis Lab;
- Encrypted Research Library;
- Defense Notebook Pack i vanjske notebook integracije.

## 28. Izvan opsega ove specifikacije

- implementacijski task breakdown i procjene;
- odabir konkretnog cloud queue providera;
- potpuna Encrypted Research Library implementacija;
- trajni cloud rukopis kao canonical kopija;
- zaobilaženje paywalla;
- zamjena Zotera kao reference managera;
- zamjena Lekte u tehničkoj provjeri Word dokumenta;
- automatsko proglašavanje cijelog rada spremnim bez korisničkog pregleda;
- automatsko generiranje lažnog jamovi ili Jupyter outputa;
- puštanje autonomnog approvala prije policy testova i Golden Research gatea;
- produkcijski DDL u Katedra repozitoriju.

## 29. Završna odluka

Odobreni smjer je:

```text
Katedra kao jedino korisničko sučelje i project authority
+ zasebni Research Notebook workspace
+ kontekstualni Evidence panel u /pisi
+ canonical minimalni Evidence Ledger
+ lokalni rukopis i lokalni puni izvori
+ privremeni Research Runtime storage
+ zasebni modularni Python Research Runtime
+ Lekta repo kao schema authority
+ transactional outbox i capability-signed workeri
+ hibridni approval u MVP-u
+ policy-based autonomija kasnije
```

Specifikacija nema neriješenih placeholdera ni dizajnerskih odluka. Sljedeći korak nakon korisničkog pregleda je izrada zasebnog implementacijskog plana koji razbija Release A na male TDD cjeline i cross-repo preduvjete.
