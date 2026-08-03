/**
 * lib/katedra/tools.ts — alati koje model smije zvati.
 *
 * Skill je alate imao kao skripte s izlaznim kodovima. Ovdje su to funkcije s
 * ishodima, i jedna razlika nosi najviše težine:
 *
 *   `find_profile.py` je vraćao kod 2 = „više kandidata, PITAJ, ne biraj sam".
 *   To je bilo pravilo koje model nije mogao zaobići jer ga je nosio izlazni kod.
 *
 * Ovdje isto radi `status: "vise-kandidata"` — alat NE vraća profil, nego popis.
 * Model nema što odabrati jer mu ništa nije ni ponuđeno kao odabrano. Registry ima
 * 395 profila po studijskom programu; „fpzg" je 13 različitih programa s različitim
 * pravilima. Pogoditi znači dati radu tuđa pravila, bez ijednog upozorenja.
 *
 * Sheme su JSON Schema, pa rade i s Anthropic SDK-om (`tools`) i s Vercel AI SDK-om
 * (`jsonSchema()`). Zod nije korišten namjerno — shema ide modelu, a model je vidi
 * kao JSON; jedan oblik manje za održavati.
 */

export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

const RAZINE = ["KRITICNO", "SREDNJE", "KOZMETICKO", "RUCNO_PROVJERI"] as const;

/* ------------------------------------------------------- profil fakulteta */

export const resolveProfile: ToolDef = {
  name: "resolve_profile",
  description:
    "Nađi profil fakulteta iz slobodnog teksta (naziv fakulteta + smjer + vrsta rada). " +
    "Registry ima 395 profila PO STUDIJSKOM PROGRAMU, ne po fakultetu — 'fpzg' je 13 " +
    "različitih programa. Zovi ovo prije bilo kakve tvrdnje o formatu, opsegu ili " +
    "citatnom stilu.\n\n" +
    "Ishodi:\n" +
    "  jedan-pogodak   → koristi `profil`\n" +
    "  vise-kandidata  → PITAJ studenta koji je njegov i ponudi `kandidati`. " +
    "Ne biraj sam i ne pretpostavljaj da je prvi najvjerojatniji.\n" +
    "  nema-pogotka    → pitaj puni naziv fakulteta i smjera; ako ga registry nema, " +
    "radi s općim pravilima i to izrijekom reci.",
  input_schema: {
    type: "object",
    properties: {
      upit: {
        type: "string",
        description:
          "Ono što je student rekao, npr. 'ekonomski fakultet računovodstvo' ili " +
          "'FPZG politologija'. Ne prevodi i ne skraćuj u slug.",
      },
      tip: {
        type: "string",
        enum: ["seminarski", "zavrsni", "diplomski", "esej"],
        description: "Vrsta rada, ako je poznata — sužava izbor.",
      },
    },
    required: ["upit"],
    additionalProperties: false,
  },
};

export const getProfileRules: ToolDef = {
  name: "get_profile_rules",
  description:
    "Dohvati pravila razriješenog profila: format, opseg, citatni stil, obavezni " +
    "dijelovi, izvori.\n\n" +
    "Svako pravilo dolazi s `pouzdanost`. Kad je 'nepotvrdeno', pravilo NIJE propis " +
    "te ustanove — ne piši 'fakultet traži X'. Kad je `baseline_format: true`, " +
    "ustanova oblikovanje uopće ne propisuje i prikazane vrijednosti su opći " +
    "akademski običaj.\n\n" +
    "`izvori` je popis, i prvi u nizu nije nužno onaj koji pokriva pravilo o kojem " +
    "govoriš. Kad citiraš pravilo, citiraj dokument koji ga doista sadrži.",
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "Slug iz `resolve_profile`." },
      tip: {
        type: "string",
        enum: ["seminarski", "zavrsni", "diplomski", "esej"],
      },
    },
    required: ["slug"],
    additionalProperties: false,
  },
};

/* -------------------------------------------------------------- plan rada */

export const planUpsert: ToolDef = {
  name: "plan_upsert",
  description:
    "Zapiši ili osvježi plan rada. Zovi ovo čim je plan dogovoren — plan koji je " +
    "ostao samo u razgovoru nestaje sljedeću sesiju, a mod pisanja se oslanja na " +
    "njega. Šalje se CIJELI plan; stavke koje izostaviš se brišu.",
  input_schema: {
    type: "object",
    properties: {
      stavke: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            oznaka: { type: "string", description: "Npr. '2.1'. Kako student vidi u sadržaju." },
            naslov: { type: "string" },
            sto: {
              type: "string",
              description:
                "Što točno ide unutra — jedna do dvije rečenice. Bez ovoga se plan " +
                "za tjedan dana čita kao popis naslova i nije izvediv.",
            },
            stranice: { type: "number", description: "Procjena opsega u stranicama." },
            izvori: {
              type: "array",
              items: { type: "string" },
              description: "Oznake priložene građe koja pokriva ovo potpoglavlje.",
            },
          },
          required: ["oznaka", "naslov"],
          additionalProperties: false,
        },
      },
    },
    required: ["stavke"],
    additionalProperties: false,
  },
};

export const planNext: ToolDef = {
  name: "plan_next",
  description:
    "Koje je potpoglavlje sljedeće na redu. Zovi ovo umjesto da pitaš studenta gdje " +
    "ste stali — odgovor je u podacima, a pitanje odaje da ne pratiš rad.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
};

export const planMark: ToolDef = {
  name: "plan_mark",
  description: "Označi napredak na potpoglavlju nakon što je napisano.",
  input_schema: {
    type: "object",
    properties: {
      oznaka: { type: "string" },
      status: {
        type: "string",
        enum: ["nije-napisano", "u-tijeku", "napisano", "odobreno"],
      },
      rijeci: { type: "integer", minimum: 0, description: "Stvaran broj riječi, ne procjena." },
    },
    required: ["oznaka", "status"],
    additionalProperties: false,
  },
};

export const planDeviate: ToolDef = {
  name: "plan_deviate",
  description:
    "Zapiši odstupanje od plana: drugi izvor, drugačiji opseg, izbačeno ili dodano " +
    "potpoglavlje.\n\n" +
    "Zovi ovo UVIJEK kad odstupiš, i onda kad je odstupanje očito dobra odluka. " +
    "Odstupanje koje se samo spomene u razgovoru mentor nikad ne vidi, a upravo ono " +
    "je najčešće pitanje na obrani. Zapis se ne može poslije prepraviti.",
  input_schema: {
    type: "object",
    properties: {
      oznaka: { type: "string" },
      razlog: {
        type: "string",
        minLength: 10,
        description: "Zašto, konkretno. 'Promijenjeno' nije razlog.",
      },
    },
    required: ["oznaka", "razlog"],
    additionalProperties: false,
  },
};

/* --------------------------------------------------------------- provjere */

export const runChecks: ToolDef = {
  name: "run_checks",
  description:
    "Pokreni provjere nad zadnjom verzijom rada. Vraća `{ nalazi, mjere, preskoceno }`.\n\n" +
    "`preskoceno` nikad ne prešuti: provjera koja nije mogla trčati (nema građe, nema " +
    "profila) znači da audit nije potpun, a izvještaj koji to ne kaže čita se kao da " +
    "je sve provjereno.\n\n" +
    "Nalaz s `pouzdanost: 'nepotvrdeno'` ne podiži u tekstu na višu težinu nego što " +
    "ju je alat dao.",
  input_schema: {
    type: "object",
    properties: {
      provjere: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "pravila",        // format i struktura prema profilu fakulteta
            "citati",         // siročad, rupe, pokrivenost popisa
            "izvori",         // postoje li navedeni izvori (Crossref, Hrčak)
            "tipografija",    // hrvatski navodnici, jedinice, crtice
            "polja",          // TOC, numeracija, neprihvaćene izmjene, komentari
            "ponavljanje",    // početci rečenica, fraze, ritam
            "brojke",         // dosljednost brojki i jedinica kroz rad
            "argument",       // teza, hipoteze, struktura poglavlja, atribucija
            "ai_stil",        // tragovi generiranog teksta
            "preklapanje",    // doslovno preklapanje s priloženom građom
          ],
        },
        description: "Ako izostaviš, pokreću se sve primjenjive.",
      },
    },
    additionalProperties: false,
  },
};

export const recordFinding: ToolDef = {
  name: "record_finding",
  description:
    "Zapiši nalaz koji si SAM uočio, a nijedan alat ga ne hvata — npr. teza koja se " +
    "ne brani, poglavlje koje ne odgovara na svoje pitanje, zaključak koji tvrdi više " +
    "od podataka.\n\n" +
    "To su najvrjedniji nalazi u cijelom proizvodu, jer su jedini koje parser ne može " +
    "dati. Zapiši ih da prežive sesiju.\n\n" +
    "KRITIČNO koristi samo kad nešto stvarno blokira ocjenu ili predaju.",
  input_schema: {
    type: "object",
    properties: {
      razina: { type: "string", enum: [...RAZINE] },
      sto: { type: "string", description: "Jedna rečenica, konkretno." },
      detalj: { type: "string" },
      primjer: {
        type: "string",
        description: "Doslovan citat iz rada. Bez njega je nalaz neprovjerljiv.",
      },
    },
    required: ["razina", "sto"],
    additionalProperties: false,
  },
};

/* -------------------------------------------------- zamjerke mentora */

export const listZamjerke: ToolDef = {
  name: "list_zamjerke",
  description:
    "Otvorene zamjerke mentora. Prođi kroz njih prije svake veće isporuke: ako je " +
    "otvorena zamjerka relevantna za dio koji upravo pišeš, riješi je sada ili je " +
    "izrijekom navedi u tablici RUČNO PROVJERI.\n\n" +
    "Komentar mentora koji se spomene na početku pa zaboravi je najskuplja greška u " +
    "cijelom procesu — vraća rad na doradu zbog nečega što je već bilo rečeno.",
  input_schema: {
    type: "object",
    properties: {
      samo_otvorene: { type: "boolean", default: true },
      kategorija: {
        type: "string",
        enum: ["citiranje", "prikazi", "struktura", "metodologija", "jezik", "format", "ostalo"],
      },
    },
    additionalProperties: false,
  },
};

export const closeZamjerka: ToolDef = {
  name: "close_zamjerka",
  description:
    "Zatvori zamjerku mentora — samo kad je u tekstu VIDLJIVO riješena.\n\n" +
    "`kako` je obavezan i mora reći što je konkretno napravljeno ('dodana referenca " +
    "Lindblom 1959, str. 14'), ne da je riješeno. Baza odbija zatvaranje bez toga.\n\n" +
    "Ne zatvaraj zamjerku zato što si o njoj razgovarao sa studentom.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string" },
      kako: { type: "string", minLength: 10 },
    },
    required: ["id", "kako"],
    additionalProperties: false,
  },
};

/* ----------------------------------------------------------- dokument */

export const snapshot: ToolDef = {
  name: "snapshot",
  description:
    "Spremi trenutnu verziju rada prije izmjene dokumenta. OBAVEZNO prije bilo kakvog " +
    "zahvata u .docx — bez toga nema povratka, a .docx nema upotrebljiv diff.",
  input_schema: {
    type: "object",
    properties: {
      biljeska: { type: "string", description: "Zašto snimaš, npr. 'prije sređivanja formata'." },
    },
    required: ["biljeska"],
    additionalProperties: false,
  },
};

export const diffVersions: ToolDef = {
  name: "diff_versions",
  description:
    "Usporedi dvije verzije rada. `za_mentora: true` daje sažetak izmjena u obliku " +
    "koji student može poslati mentoru.\n\n" +
    "Provjeri je li koji citat tiho nestao: to je najčešća šteta pri prepisivanju — " +
    "tekst zvuči bolje, a tvrdnja je ostala bez potpore.",
  input_schema: {
    type: "object",
    properties: {
      od: { type: "integer", description: "Redni broj starije verzije." },
      do: { type: "integer", description: "Redni broj novije. Izostavi za zadnju." },
      za_mentora: { type: "boolean", default: false },
    },
    required: ["od"],
    additionalProperties: false,
  },
};

export const createRad: ToolDef = {
  name: "create_rad",
  description:
    "Otvori novi rad. Zovi čim znaš vrstu, temu i fakultet — ne čekaj da se popune " +
    "sva polja. Ostalo se doda kasnije.",
  input_schema: {
    type: "object",
    properties: {
      mod: {
        type: "string",
        enum: ["novi-rad", "pisanje", "poboljsanje", "audit", "obrana", "predaja"],
      },
      tip: { type: "string", enum: ["seminarski", "zavrsni", "diplomski", "esej"] },
      tema: { type: "string", minLength: 3 },
      fakultet_slug: {
        type: "string",
        description:
          "Iz `resolve_profile`. Ako profil nije razriješen, IZOSTAVI ovo polje i " +
          "upiši ograničenje — nikad ne izmišljaj slug.",
      },
      mentor: { type: "string" },
      rok: { type: "string", format: "date" },
      ogranicenja: {
        type: "array",
        items: { type: "string" },
        description: "Što student nema, npr. 'nema izvorne građe' ili 'nema uputa fakulteta'.",
      },
    },
    required: ["mod", "tip", "tema"],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------ po modovima */

export const SVI_ALATI: ToolDef[] = [
  createRad, resolveProfile, getProfileRules,
  planUpsert, planNext, planMark, planDeviate,
  runChecks, recordFinding,
  listZamjerke, closeZamjerka,
  snapshot, diffVersions,
];

/**
 * Alati po modu.
 *
 * Model koji u modu pisanja vidi `plan_upsert` prije ili kasnije prepiše plan
 * usred poglavlja. Sužavanje skupa je jeftinije i pouzdanije od upute da to ne radi.
 */
export const ALATI_ZA_MOD: Record<string, ToolDef[]> = {
  "novi-rad":   [resolveProfile, getProfileRules, planUpsert, planNext],
  pisanje:      [planNext, planMark, planDeviate, getProfileRules, listZamjerke, closeZamjerka],
  poboljsanje:  [getProfileRules, runChecks, recordFinding, listZamjerke, closeZamjerka,
                 snapshot, diffVersions],
  audit:        [getProfileRules, runChecks, recordFinding, listZamjerke, diffVersions],
  obrana:       [planNext, getProfileRules, listZamjerke],
  predaja:      [getProfileRules, runChecks, snapshot, diffVersions, listZamjerke],
};

/** Alati za studenta koji još nema rad. */
export const ALATI_INTAKE: ToolDef[] = [resolveProfile, createRad];
