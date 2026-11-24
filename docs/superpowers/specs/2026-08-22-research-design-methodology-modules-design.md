# Research Design Canvas i Methodology Builder — dizajn

## Cilj

Izgraditi prvi stvarni napredni modul Katedre za zaključani, plaćeni završni ili
diplomski projekt. Modul korisniku daje strukturirani prostor za definiranje
istraživačkog dizajna i metodologije, sprema ga lokalno uz projekt, uključuje ga
u ograničeni AI/agentski kontekst i čuva lokalne verzije prije većih izmjena.

Ovo nije samo capability oznaka u Pass dijalogu. Mora postojati stvaran ekran,
uređivanje, spremljeno stanje, status plana, verzije i browser test cijelog toka.

## Granice i pristup

### Uključeno

- Research Design Canvas s poljima: problem, cilj, istraživačko pitanje,
  hipoteze, varijable, slučajevi/uzorak i očekivani doprinos;
- Methodology Builder s poljima: dizajn, uzorak, operacionalizacija, instrument,
  analiza, ograničenja i etika;
- lokalno spremanje po canonical `projectId` u IndexedDB;
- statusi `empty`, `draft`, `review` i `approved`;
- ručno uređivanje, spremanje, slanje na pregled, odobravanje i vraćanje lokalne
  verzije;
- pristup samo uz verified akademski profil i aktivni završni/diplomski Pass,
  odnosno postojeći lokalni admin override za testiranje;
- feature flag `KATEDRA_RESEARCH_MODULES_ENABLED`, koji je u produkciji
  isključen dok staging ugovori nisu dokazani;
- sažeti research-plan kontekst za AI prompt i agentski payload bez slanja
  cijelog rukopisa ili sirovog lokalnog dokumenta;
- sljedeća radnja projekta koja se mijenja nakon odobrenja plana.

### Nije uključeno u ovaj slice

- Evidence Matrix kao zaseban modul;
- Mentor Review Cycles i Defense Simulator;
- sinkronizacija punog plana na shared backend;
- automatsko prihvaćanje AI promjena bez snapshot-a;
- statistički izračuni, bibliografsko pretraživanje ili metodološka validacija
  koja bi zamijenila mentora;
- uključivanje modula u javni Pass katalog prije staging provjere.

## Lokalni model

Plan je odvojeni lokalni artefakt kako postojeći `ManuscriptV1` i njegov
validated storage ne bi dobili implicitnu promjenu semantike.

```ts
type ResearchPlanStatus = 'empty' | 'draft' | 'review' | 'approved'

interface ResearchPlanFieldV1 {
  id: string
  value: string
  updatedAt: string
}

interface ResearchPlanV1 {
  schemaVersion: 1
  projectId: string
  status: ResearchPlanStatus
  design: {
    problem: string
    goal: string
    researchQuestion: string
    hypotheses: ResearchPlanFieldV1[]
    variables: ResearchPlanFieldV1[]
    cases: ResearchPlanFieldV1[]
    expectedContribution: string
  }
  methodology: {
    design: string
    sample: string
    operationalization: string
    instrument: string
    analysis: string
    limitations: string
    ethics: string
  }
  createdAt: string
  updatedAt: string
  revision: string
}
```

`ResearchPlanV1` se sprema u IndexedDB storeu `researchPlans`, ključanom s
`projectId`. Store `researchPlanSnapshots` čuva najviše 20 lokalnih snapshotova
po projektu. Svako spremanje je validirano; nepoznata polja, tuđi `projectId`,
predugi tekstovi i neispravni statusi odbacuju se.

Za `review` su obavezni problem, cilj, istraživačko pitanje, dizajn, uzorak,
operacionalizacija, instrument, analiza, ograničenja i etika. Hipoteze,
varijable i slučajevi su ponavljajuća polja: mogu biti prazni kada to odgovara
istraživačkom dizajnu, ali svaki dodani zapis mora imati tekst. `approved` se
može postaviti samo iz valjanog `review` plana; svaka izmjena odobrenog plana
vraća ga u `draft` i stvara snapshot prethodne verzije.

## UI

U projektni drawer dodaje se stavka **Istraživački plan** samo kada server-side
capability odluka i lokalni feature gate dozvole pristup. Ekran ima:

1. zaglavlje s profilom, statusom verificiranih pravila i zadnjim spremanjem;
2. dvije jasno odvojene cjeline, Research Design Canvas i Methodology Builder;
3. ponavljajuća polja za hipoteze, varijable i slučajeve/uzorak;
4. akcije `Spremi nacrt`, `Pošalji na pregled`, `Odobri plan` i `Vrati zadnju
   verziju`;
5. inline poruke za nedostajuća obavezna polja;
6. oznaku da je sadržaj lokalno spremljen i da ga AI neće promijeniti bez
   potvrde korisnika.

Na mobilnom prikazu cjeline se slažu jedna ispod druge; nema horizontalnog
overflowa. `prefers-reduced-motion` uklanja tranzicije.

## Pristup i sigurnost

Novi capabilityji su `research_design` i `methodology`. Server odluka mora
provjeriti authenticated usera, canonical ownership projekta, verified
academic profile, zaključani product tier i aktivni entitlement. `seminarski`
ne dobiva ove capabilityje; `zavrsni` i `diplomski` ih mogu dobiti samo kada je
feature flag aktivan. Client-side vrijednosti ne mogu otključati modul.

Lokalni admin override koristi postojeći server-side razvojni mehanizam i ne
stvara lažni Stripe entitlement.

## AI i agentski kontekst

Dodaje se ograničeni serializer:

```ts
serializeResearchPlanContext(plan: ResearchPlanV1): {
  status: ResearchPlanStatus
  design: Record<string, unknown>
  methodology: Record<string, string>
}
```

Serializer šalje samo odabrana polja i bounded duljine. Ne smije sadržavati
cijeli Tiptap dokument, lokalne snapshotove, neobrađene priloge ili privatne
bilješke izvan plana. AI prijedlog se prikazuje kao prijedlog; prihvaćanje
stvara snapshot rukopisa/plana prije upisa.

## Testni kriteriji

- validacija prihvaća kompletan plan i odbija neispravan status, tuđi projekt i
  prekoračene duljine;
- IndexedDB save/load i snapshot/restore rade po project ID-u;
- zaključani seminarski ili neverified projekt ne može otvoriti modul;
- verified završni/diplomski projekt s aktivnim Passom može ga otvoriti;
- korisnik može dodati i ukloniti hipotezu, varijablu i slučaj;
- statusni tijek je `empty → draft → review → approved`, bez preskakanja
  potrebne validacije, uz vraćanje izmijenjenog odobrenog plana u `draft`;
- reload vraća isti plan i status;
- Project Home nakon `approved` prikazuje sljedeći korak koji koristi odobreni
  plan;
- AI/context builder dobiva samo bounded research-plan payload;
- browser E2E prolazi u light/dark desktop i mobilnom prikazu bez overflowa;
- postojeći landing, auth, legal, checkout i V1 Pass copy ostaju nepromijenjeni;
- svi root quality gateovi prolaze.

## Release granica

Lokalna implementacija može se testirati kroz admin preview ili stvarni staging
Pass, ali javni Pass katalog ne smije tvrditi da su moduli uključeni dok
canonical entitlement, feature flag, staging E2E i billing ugovori nisu
potvrđeni.
