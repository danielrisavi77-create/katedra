# Academic Context Compiler — dizajn

## Problem

`public/katedra-pack.json` sadrži 130 ustanova i 395 profila, uključujući status
verifikacije, datum provjere, opseg rada, minimalne izvore, formatiranje,
obvezne sekcije, ručne provjere i službene izvore. Trenutačni
`lib/manuscript/academic-catalog.ts` zadržava samo identitet ustanove/profila i
work type. Zbog toga isti korisnički odabir ne utječe na Completion Scan,
promptove, outline, agentički kontekst, Pravila ili Pass capability.

## Cilj

Uvesti jedan deterministički, read-only `AcademicContext` koji se izvodi iz
verzioniranog packa i koji svi akademski potrošači koriste kao jedini izvor
profilskih pravila.

## Granice

- Pack ostaje statički artifact koji generira Lekta; Katedra ga ne uređuje.
- Compiler ne provjerava je li URL izvor stvarno dostupan u runtimeu; status i
  datum dolaze iz packa, a Lekta ostaje authority za konačnu provjeru.
- Ne uvodi se nova shared database tablica ni kopiranje cijelog packa u
  rukopis.
- Free-text institucija bez jedinstvenog profila dobiva `generic` kontekst.
- `partial` i `research` profili mogu se odabrati radi transparentnosti, ali
  ne otključavaju verified fakultetski coaching niti paid profile claims.

## Canonical model

`lib/academic-context/types.ts` definira:

```ts
type AcademicRuleStatus = 'verified' | 'partial' | 'research' | 'generic'

interface AcademicContext {
  unitId: string
  profileId: string
  institutionName: string
  institutionLabel: string
  profileLabel: string
  workType: string
  status: AcademicRuleStatus
  verifiedAt?: string
  wordRange?: { min?: number; max?: number }
  pageRange?: { min?: number; max?: number }
  minimumReferences?: number
  minimumBooks?: number
  citationStyle?: string
  formatting?: { font?: string; fontSize?: number; lineSpacing?: number }
  requiredSections: string[]
  manualChecks: string[]
  facts: string[]
  submissionFacts: string[]
  sources: Array<{ title: string; url: string }>
  aiPolicy: { mode: 'full' | 'generic' | 'coaching'; claims: string[] }
  capabilities: {
    facultyCoaching: boolean
    paidPass: boolean
    webResearch: boolean
    autonomousRun: boolean
  }
}
```

`AcademicProfile` u katalogu dobiva sva raw pravila potrebna za kompilaciju;
postojeća selector API imena ostaju kompatibilna.

## Kompilacija i fallback

`load-pack.ts` validira top-level pack, profile i izvore te odbacuje nevaljane
vrijednosti. `resolve-profile.ts` rezolvira profil po `profileId`, provjerava
`unitId` i kompatibilni work type te vraća strukturirani razlog neuspjeha.

`compile-context.ts` radi sljedeće:

- `wordMin/wordMax` i `pageMin/pageMax` mapira u ranges;
- `minReferences` mapira izravno;
- `minimumBooks` izvodi samo iz eksplicitnih činjenica/provjera poput
  “najmanje 3 knjige”; ne nagađa kada broj nije naveden;
- `citation` mapira u čitljivi stil kroz centralni registry, a ne kroz prompt;
- `sections`, `manualChecks`, `facts`, `submissionFacts` i `sources` kopira uz
  bounded limits i bez raw nepoznatih polja;
- formatiranje mapira font, veličinu i prored kada su validni;
- `verified` zadržava puni profil samo ako ima važeći status i datum;
- nepoznat ili nedostatan profil vraća `generic` kontekst.

Statusna pravila:

| Status | Vidljivost | AI/capability ponašanje |
|---|---|---|
| `verified` | profil, datum, izvori i pravila | puni fakultetski coaching i relevantni Pass |
| `partial` | jasno označeno “djelomično potvrđeno” | generički/free coaching, bez fakultetskih tvrdnji |
| `research` | jasno označeno “u istraživanju” | opći free način rada |
| `generic` | “pravila nisu povezana” | opći free način rada, bez Passa temeljenog na profilu |

`visibility.ts` centralizira capability odluke. UI nikada sam ne zaključuje da
je profil verified samo zato što postoji `profileId`; server capability sloj
mora ponovno provjeriti status i canonical project identity.

## Potrošači

- Completion Scan prima `academicContext` i iz njega izvodi status, cilj riječi,
  minimum izvora, otvorene provjere i profil-specific next actions.
- Onboarding nakon odabira profila kompilira kontekst, ali u manifest sprema
  samo `unitId`, `profileId` i kompaktne korisničke metapodatke.
- Početni outline koristi `requiredSections`, uz očuvanje postojećih sekcija
  ako korisnik već ima odobren plan.
- AI prompt dobiva bounded academic rules block s citatnim stilom, opsegom,
  sekcijama i izvorima; ne dobiva cijeli pack ni neograničene submission facts.
- Agent context i worker payload dobivaju isti serializirani bounded context;
  `generic`/`partial` policy nikada se ne može nadjačati klijentskim poljem.
- Project Home i Pravila prikazuju status, datum provjere, formatiranje,
  required sections, checks i linkove na službene izvore; ručna polja ostaju
  samo za mentora, rok i korisničke napomene.
- Export i Lekta handoff dobivaju upozorenje o profilu/statusu te izvorima, ali
  nikad ne tvrde da Katedra certificira DOCX.
- Pass dostupnost koristi `verified` status kao uvjet za fakultetski product
  claim; partial/research/generic ostaju free/generic.

## Freshness

`freshness.ts` validira ISO datum, računa dob prema konfiguriranom advisory
pragu i vraća samo prezentacijski signal. Stari verified profil ne postaje
automatski partial bez eksplicitne product odluke, ali UI mora prikazati da je
provjera stara i preporučiti ponovnu provjeru. Nedostatan datum nikada nije
dokaz verified statusa.

## Testni kriteriji

- loader zadržava raw pravila za FPZG diplomski profil;
- compiler vraća FPZG politologija diplomski: 10.000–12.000 riječi, 15 izvora,
  3 knjige, FPZG autor–godina, required sections i službene izvore;
- FPZG politologija završni daje drugačiji opseg i minimum izvora;
- partial profil ne dobiva paid/faculty capability;
- generic/free-text projekt ne dobiva fakultetsku tvrdnju;
- isti context serializer koriste Completion Scan, AI prompt i agent payload;
- promjena profila mijenja outline, cilj riječi, minimum izvora, AI policy i
  prikaz izvora;
- izvori uvijek imaju naslov i URL, a svaki displayed rule ima status/datum;
- malformed pack i nepoznat work type fail-closed bez rušenja onboarding UI-ja.
