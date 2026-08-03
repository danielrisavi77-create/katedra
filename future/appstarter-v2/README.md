# katedra u aplikaciji — shema + promptovi

Dvije datoteke i jedna migracija. Prijevod katedra skilla na Next.js App Router +
Supabase, uz jednu odluku koja objašnjava sve ostale:

> **Pravilo koje može ući u shemu baze ne piše se u prompt.**

Prompt se refaktorira, skraćuje, prevodi i A/B testira. Ograničenje u bazi ne. Zato
su tri pravila skilla ovdje `CHECK` constrainti, a ne rečenice modelu.

## Datoteke

| Datoteka | Što je |
|---|---|
| `supabase/migrations/0001_katedra_core.sql` | 8 tablica, 2 pogleda, RLS, ograničenja |
| `lib/katedra/prompts.ts` | sistemski prompt, upute po modu, stanje kao blok |
| `lib/katedra/tools.ts` | 13 alata s JSON Schema ulazima |

## Što je u shemi, a ne u promptu

| Pravilo skilla | Kako je izvedeno |
|---|---|
| Zamjerka se ne zatvara bez dokaza | `CHECK zatvaranje_trazi_dokaz` + `zatvori_zamjerku()` |
| Odstupanje od plana se zapisuje, nikad tiho | `plan_odstupanja` bez UPDATE/DELETE politike |
| Nema analize bez snapshota | `nalazi.verzija_id NOT NULL` |
| Nepotvrđeno pravilo ne daje KRITIČNO | `CHECK kapa_na_tezinu` |
| Audit traži priložen rad | `CHECK audit_treba_rad` |
| Plan se ne odobrava prazan | trigger `radovi_plan_checkpoint` |
| Napisano potpoglavlje ima riječi | `CHECK napisano_ima_rijeci` |

Provjereno na PostgreSQL 16: svih osam negativnih slučajeva pada, pozitivni prolaze,
RLS je na svih 8 tablica (9 politika).

## Wiring

```ts
// app/api/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sistemskiPrompt, SYSTEM_INTAKE, type StanjeRada } from "@/lib/katedra/prompts";
import { ALATI_ZA_MOD, ALATI_INTAKE } from "@/lib/katedra/tools";

export async function POST(req: Request) {
  const { radId, messages } = await req.json();
  const db = await createClient();

  // Stanje se ČITA iz baze i injektira — model ga nikad ne traži i nikad ne pita
  // ono što u njemu piše. To je zamjena za guard iz SKILL.md 0.1.
  const stanje = radId ? await ucitajStanje(db, radId) : null;

  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: stanje ? sistemskiPrompt(stanje) : SYSTEM_INTAKE,
    tools: (stanje ? ALATI_ZA_MOD[stanje.mod] : ALATI_INTAKE).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
    messages,
  });

  return new Response(stream.toReadableStream());
}

async function ucitajStanje(db: SupabaseClient, radId: string): Promise<StanjeRada> {
  const [{ data: rad }, { data: napredak }, { data: sljedeca }] = await Promise.all([
    db.from("radovi").select("*").eq("id", radId).single(),
    db.from("v_napredak").select("*").eq("rad_id", radId).maybeSingle(),
    db.from("v_sljedeca_stavka").select("*").eq("rad_id", radId).maybeSingle(),
  ]);
  return {
    id: rad.id,
    mod: rad.mod,
    tip: rad.tip,
    tema: rad.tema,
    fakultetSlug: rad.fakultet_slug,
    fakultetNaziv: rad.fakultet_naziv,
    mentor: rad.mentor,
    rok: rad.rok,
    citatniStil: rad.citatni_stil,
    planOdobren: rad.plan_odobren,
    ogranicenja: rad.ogranicenja ?? [],
    napredak: napredak
      ? {
          stavki: napredak.stavki,
          gotovo: napredak.gotovo,
          rijeci: napredak.rijeci,
          otvorenihZamjerki: napredak.otvorenih_zamjerki,
          kriticnihNalaza: napredak.kriticnih_nalaza,
        }
      : undefined,
    sljedecaStavka: sljedeca
      ? { oznaka: sljedeca.oznaka, naslov: sljedeca.naslov, sto: sljedeca.sto }
      : null,
  };
}
```

RLS radi sav posao autorizacije: `createClient()` sa sesijom korisnika vidi samo
njegove radove. Nema `where user_id = ...` u aplikacijskom kodu, pa se ne može
zaboraviti.

## Što alat `resolve_profile` treba iza sebe

395 profila iz Lekte. Dvije opcije:

1. **Statički asset** — `references/fakulteti/index.json` iz skilla (172 KB) ide u
   `public/`, pretraga je u memoriji. Najbrže za pokretanje.
2. **Tablica u Supabaseu** — `profili` + `profil_izvori`, punjena istim uvozom.
   Nužno čim želiš da se registry osvježava bez deploya.

U oba slučaja **pretraga mora vraćati `vise-kandidata` kad ih ima.** To je jedino
mjesto gdje model ne smije pogađati: „fpzg" je 13 programa s različitim pravilima, a
kriv profil znači da rad dobije tuđa pravila i nitko to ne primijeti.

Uz svaki profil moraju putovati i tri polja bez kojih se vraća kvar koji je skill
već jednom imao:

- `pouzdanost` po bloku — pravilo koje izvor ne tvrdi ne smije dati KRITIČNO
- `baseline_format` — 26 profila gdje ustanova oblikovanje uopće ne propisuje
- `izvori` kao POPIS — prvi dokument nije nužno onaj koji pokriva pravilo

## Čega namjerno nema

- **Izbornika sa šest modova.** Skill ga ima jer je alat za jednog čovjeka koji zna
  razliku. Student ne zna razliku između „poboljšanja" i „audita" i ne bi ju trebao
  morati znati — mod se izvodi iz onoga što je rekao i priložio (v. `SYSTEM_INTAKE`).
- **Svih 13 alata u svakom modu.** Model koji u modu pisanja vidi `plan_upsert`
  prije ili kasnije prepiše plan usred poglavlja. `ALATI_ZA_MOD` to sprječava
  strukturno, ne uputom.
- **Duljine.** Sistemski prompt je pet pravila i pola kartice. Duljina ne kupuje
  poslušnost.
