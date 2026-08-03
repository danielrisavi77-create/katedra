-- =====================================================================
-- katedra — jezgra stanja (v1)
--
-- Prijevod `.katedra/*.json` iz katedra skilla u multi-tenant Postgres.
--
-- Skill je jednokorisnički: jedan rad, jedan direktorij, datoteke na disku.
-- Aplikacija je višekorisnička i konkurentna, pa se ne prenosi oblik datoteka
-- nego NAMJERA iza njih. Tri pravila skilla ovdje prestaju biti stvar discipline
-- i postaju ograničenja baze:
--
--   1. Zamjerka se ne zatvara bez dokaza     → CHECK na `kako_rijeseno`
--   2. Odstupanje od plana se zapisuje       → `plan_odstupanja` je append-only
--   3. Nema izmjene dokumenta bez snapshota  → `nalazi.verzija_id` je NOT NULL
--
-- Ono što je u skillu bila navika, ovdje ne može ispasti iz koda.
--
-- Pokretanje:  supabase migration up   (ili psql -f)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enumi
-- Vokabulari su zaključani jer se preko njih grana logika. String bi ovdje
-- značio da 'diplomski' i 'Diplomski' u istoj tablici prođu oba.

create type katedra_mod as enum
  ('novi-rad', 'pisanje', 'poboljsanje', 'audit', 'obrana', 'predaja');

create type katedra_tip_rada as enum
  ('seminarski', 'zavrsni', 'diplomski', 'esej');

create type katedra_citatni_stil as enum
  ('autor-godina', 'IEEE', 'fusnote');

create type katedra_status_stavke as enum
  ('nije-napisano', 'u-tijeku', 'napisano', 'odobreno');

create type katedra_kategorija_zamjerke as enum
  ('citiranje', 'prikazi', 'struktura', 'metodologija', 'jezik', 'format', 'ostalo');

create type katedra_izvor_zamjerke as enum
  ('komentar', 'umetnuto', 'obrisano', 'rucno');

-- Redoslijed je namjerno od najtežeg: `order by razina` daje ispravan prioritet
-- bez dodatnog mapiranja u aplikaciji.
create type katedra_razina as enum
  ('KRITICNO', 'SREDNJE', 'KOZMETICKO', 'RUCNO_PROVJERI');

-- `nepotvrdeno` = pravilo nema pokriće u izvoru koje bi opravdalo KRITIČNO.
create type katedra_pouzdanost as enum ('potvrdeno', 'nepotvrdeno');


-- ---------------------------------------------------------------- radovi
-- Iz `stanje.json`. Jedan redak = jedan studentski rad kroz cijeli životni ciklus.

create table public.radovi (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,

  mod             katedra_mod       not null,
  tip             katedra_tip_rada  not null,
  tema            text              not null check (length(btrim(tema)) between 3 and 500),

  -- Slug iz registryja (`references/fakulteti/`). NULL je dopušten i normalan:
  -- „ako profila nema, ostavi slug: null i upiši ograničenje — nikad ne izmišljaj
  -- slug" (SKILL.md 0.5). Zato NEMA foreign keya na tablicu profila: profil je
  -- podatak iz Lekte i regenerira se uvozom, a rad ne smije pasti kad se slug
  -- promijeni ili profil povuče.
  fakultet_slug   text              check (fakultet_slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  fakultet_naziv  text,
  mentor          text,

  rok             date,
  citatni_stil    katedra_citatni_stil,
  ciljana_ocjena  smallint          not null default 5 check (ciljana_ocjena between 1 and 5),

  -- Što je student priložio. Oblik je zadržan iz skilla jer se skup datoteka mijenja
  -- s modovima, a jsonb to podnosi bez migracije po svakoj novoj vrsti priloga.
  datoteke        jsonb             not null default '{}'::jsonb
                    check (jsonb_typeof(datoteke) = 'object'),

  -- „Nemam X" nije blokada nego OGRANIČENJE, i mora se vidjeti u svakoj isporuci.
  -- Tekstualni niz, ne jsonb: čita ga i model i čovjek.
  ogranicenja     text[]            not null default '{}',

  plan_odobren    boolean           not null default false,
  arhiviran       boolean           not null default false,

  created_at      timestamptz       not null default now(),
  updated_at      timestamptz       not null default now(),

  -- Audit bez priloženog rada nema što auditirati. U skillu je to odbijao
  -- `stanje_init.py`; ovdje ne može ni ući u bazu.
  constraint audit_treba_rad check (
    mod <> 'audit' or coalesce((datoteke ->> 'rad_docx')::boolean, false)
  )
);

create index radovi_user_idx on public.radovi (user_id, updated_at desc)
  where not arhiviran;
create index radovi_rok_idx on public.radovi (user_id, rok)
  where rok is not null and not arhiviran;
create index radovi_fakultet_idx on public.radovi (fakultet_slug)
  where fakultet_slug is not null;


-- ---------------------------------------------------------------- verzije
-- Iz `diff_versions.py --snapshot`. Željezno pravilo 9: nijedna izmjena dokumenta
-- bez snapshota. Rollback mora biti moguć.

create table public.verzije (
  id            uuid primary key default gen_random_uuid(),
  rad_id        uuid not null references public.radovi (id) on delete cascade,

  -- Putanja u Supabase Storageu; sam .docx ne ide u bazu.
  storage_path  text not null,
  -- Isti dokument ne snima se dvaput. Ovo ujedno otkriva „popravili smo" nakon
  -- kojeg datoteka bajt-za-bajt nije dirnuta.
  sha256        char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),

  biljeska      text,
  rijeci        integer check (rijeci >= 0),
  redni_broj    integer not null check (redni_broj > 0),

  created_at    timestamptz not null default now(),

  unique (rad_id, redni_broj),
  unique (rad_id, sha256)
);

create index verzije_rad_idx on public.verzije (rad_id, redni_broj desc);


-- ----------------------------------------------------------- plan_stavke
-- Iz `plan.json.potpoglavlja`. Ugovor između moda 1 (plan) i moda 2 (pisanje).
-- „Plan kao proza se svaki put iznova interpretira; plan kao podatak se izvršava."

create table public.plan_stavke (
  id            uuid primary key default gen_random_uuid(),
  rad_id        uuid not null references public.radovi (id) on delete cascade,

  -- Oznaka kakvu student vidi u sadržaju („2.1"), ne primarni ključ.
  oznaka        text not null check (oznaka ~ '^[0-9]+(\.[0-9]+)*$'),
  redoslijed    integer not null check (redoslijed >= 0),

  naslov        text not null check (length(btrim(naslov)) between 2 and 300),
  stranice      numeric(4,1) check (stranice > 0 and stranice <= 200),
  sto           text,                          -- što točno ide unutra
  izvori        text[] not null default '{}',  -- oznake priložene građe (P1, D3…)

  status        katedra_status_stavke not null default 'nije-napisano',
  rijeci        integer not null default 0 check (rijeci >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (rad_id, oznaka),

  -- Stavka koja tvrdi da je napisana, a nema nijednu riječ, laže o napretku —
  -- a `plan_state.py next` upravo po statusu bira što je sljedeće na redu.
  constraint napisano_ima_rijeci check (
    status in ('nije-napisano', 'u-tijeku') or rijeci > 0
  )
);

create index plan_stavke_rad_idx on public.plan_stavke (rad_id, redoslijed);
create index plan_stavke_sljedeca_idx on public.plan_stavke (rad_id, redoslijed)
  where status = 'nije-napisano';


-- ------------------------------------------------------ plan_odstupanja
-- Željezno pravilo 6: odstupanje od plana se ZAPISUJE, ne samo spominje. Nikad tiho.
--
-- Zasebna tablica, ne polje u `plan_stavke`: ovo je dnevnik, a dnevnik koji se može
-- prepisati nije dnevnik. UPDATE i DELETE su oduzeti niže (RLS ih ne dodjeljuje).

create table public.plan_odstupanja (
  id            uuid primary key default gen_random_uuid(),
  stavka_id     uuid not null references public.plan_stavke (id) on delete cascade,
  razlog        text not null check (length(btrim(razlog)) >= 10),
  created_at    timestamptz not null default now()
);

create index plan_odstupanja_stavka_idx on public.plan_odstupanja (stavka_id, created_at);


-- -------------------------------------------------------------- zamjerke
-- Iz `zamjerke.json` — komentari mentora kao TRAJNA checklista.
-- „Komentar mentora koji se spomene u intakeu pa zaboravi je najskuplja greška
-- u procesu." (SKILL.md 0.7)

create table public.zamjerke (
  id             uuid primary key default gen_random_uuid(),
  rad_id         uuid not null references public.radovi (id) on delete cascade,
  verzija_id     uuid references public.verzije (id) on delete set null,

  -- Stabilan ključ iz dokumenta (id komentara u OOXML-u). Ponovni izvoz iz novije
  -- verzije rada mora prepoznati istu zamjerku i SAČUVATI njezin status, a ne
  -- otvoriti je opet. Bez ovoga svaki re-upload briše dokaz o riješenom.
  vanjski_id     text not null,

  izvor          katedra_izvor_zamjerke not null,
  autor          text,
  datum          date,
  tekst          text not null check (length(btrim(tekst)) > 0),
  kategorija     katedra_kategorija_zamjerke not null default 'ostalo',

  rijeseno       boolean not null default false,
  kako_rijeseno  text,
  rijeseno_at    timestamptz,

  created_at     timestamptz not null default now(),

  unique (rad_id, vanjski_id),

  -- „Zamjerka se ne zatvara bez dokaza: `--kako` je obavezan."
  -- U skillu je to provjeravala skripta. Ovdje to baza ne dopušta zaobići —
  -- ni iz drugog klijenta, ni iz konzole, ni iz budućeg koda koji ovo ne zna.
  constraint zatvaranje_trazi_dokaz check (
    not rijeseno
    or (kako_rijeseno is not null
        and length(btrim(kako_rijeseno)) >= 10
        and rijeseno_at is not null)
  )
);

create index zamjerke_rad_idx on public.zamjerke (rad_id, kategorija);
create index zamjerke_otvorene_idx on public.zamjerke (rad_id)
  where not rijeseno;


-- ---------------------------------------------------------------- nalazi
-- Ugovor `{mjere, nalazi}` iz `common.Izlaz`, po nalazu.

create table public.nalazi (
  id            uuid primary key default gen_random_uuid(),
  rad_id        uuid not null references public.radovi (id) on delete cascade,

  -- NOT NULL namjerno. Nalaz bez verzije ne može se ni reproducirati ni zatvoriti:
  -- „popravljeno je" je neprovjerljivo ako se ne zna NA ČEMU je nađeno. Ovo je
  -- željezno pravilo 9 pretvoreno u shemu — snapshot mora postojati PRIJE analize.
  verzija_id    uuid not null references public.verzije (id) on delete cascade,

  provjera      text not null,        -- check_rules, check_citations, cross_check…
  razina        katedra_razina not null,
  sto           text not null,
  detalj        text,
  primjer       text,

  -- Blok pravila iz profila (format, opseg, obavezni_dijelovi, citiranje) i
  -- pouzdanost tog bloka. OBA su obavezna za nalaze iz profila fakulteta.
  --
  -- Ovo je kapa na težinu iz `check_rules.Nalaz.add`. Ako se ne prenese u bazu,
  -- aplikacija će prije ili kasnije prikazati KRITIČNO za pravilo koje izvor ne
  -- tvrdi — a upravo to je kvar zbog kojeg kapa i postoji. Uz `citat_izvora`
  -- ispod, nalaz nosi vlastito opravdanje sa sobom.
  blok          text,
  pouzdanost    katedra_pouzdanost,

  izvor_url     text,
  izvor_str     text,                 -- stranica ili članak
  citat_izvora  text,                 -- doslovni citat iz službenog dokumenta

  rijeseno      boolean not null default false,
  created_at    timestamptz not null default now(),

  -- Nepotvrđeno pravilo ne smije proizvesti KRITIČNO ni SREDNJE. Isto ograničenje
  -- koje `Nalaz.add` primjenjuje u Pythonu — ponovljeno ovdje jer u aplikaciju
  -- nalazi mogu ući i mimo tog koda.
  constraint kapa_na_tezinu check (
    pouzdanost is distinct from 'nepotvrdeno'
    or razina in ('KOZMETICKO', 'RUCNO_PROVJERI')
  )
);

create index nalazi_rad_idx on public.nalazi (rad_id, razina);
create index nalazi_verzija_idx on public.nalazi (verzija_id, razina);
create index nalazi_otvoreni_idx on public.nalazi (rad_id, razina)
  where not rijeseno;
-- Za kalibraciju: koliko koja provjera okida kroz cijeli korpus.
create index nalazi_provjera_idx on public.nalazi (provjera, razina);


-- ----------------------------------------------------------------- mjere
-- „Mjera se piše UVIJEK, i kad nijedan prag ne okine — inače se raspon vidi samo
-- s jedne strane praga i kalibracija je nemoguća." (common.Izlaz)
--
-- U skillu je kalibracijski korpus bio 26 radova i pragovi su ostali nekalibrirani;
-- pet ih je bilo matematički mrtvo. U proizvodu ova tablica raste sa svakim
-- korisnikom i postaje jedina stvar koja pragove može zatvoriti. Vrijedi je puniti
-- od prvog dana, i prije nego išta iz nje čitaš.

create table public.mjere (
  id            uuid primary key default gen_random_uuid(),
  rad_id        uuid not null references public.radovi (id) on delete cascade,
  verzija_id    uuid not null references public.verzije (id) on delete cascade,

  provjera      text not null,
  kljuc         text not null,
  vrijednost    double precision not null,

  created_at    timestamptz not null default now(),
  unique (verzija_id, provjera, kljuc)
);

create index mjere_kalibracija_idx on public.mjere (provjera, kljuc, vrijednost);


-- --------------------------------------------------------- profil_autora
-- Iz `~/.katedra/profil.json`. Ponavljajuće slabosti IZMEĐU radova — ono što
-- pretvara alat u nešto što te poznaje. Ne sprema tekst radova ni osobne podatke,
-- samo nazive nalaza i brojače.

create table public.profil_autora (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  zadani_fakultet    text,
  zadani_tip         katedra_tip_rada,
  zadani_stil        katedra_citatni_stil,
  -- { "check_repetition:pocetci_recenica": 14, "citiranje:sirocad": 3 }
  slabosti           jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(slabosti) = 'object'),
  radova_zavrseno    integer not null default 0 check (radova_zavrseno >= 0),
  updated_at         timestamptz not null default now()
);


-- ------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger radovi_touch before update on public.radovi
  for each row execute function public.touch_updated_at();
create trigger plan_stavke_touch before update on public.plan_stavke
  for each row execute function public.touch_updated_at();


-- ----------------------------------------------- plan_odobren je checkpoint
-- Željezno pravilo 1: nijedno poglavlje završnog ili diplomskog prije odobrenog
-- plana. Odobrenje je checkpoint, pa se ne smije dogoditi na praznom planu.

create or replace function public.provjeri_odobrenje_plana()
returns trigger
language plpgsql
as $$
declare
  n integer;
begin
  if new.plan_odobren and not coalesce(old.plan_odobren, false) then
    select count(*) into n from public.plan_stavke where rad_id = new.id;
    if n = 0 then
      raise exception 'Plan se ne moze odobriti bez ijedne stavke (rad %)', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger radovi_plan_checkpoint before update on public.radovi
  for each row execute function public.provjeri_odobrenje_plana();


-- ------------------------------------------------------ sljedeća stavka
-- `plan_state.py next` kao pogled. „nastavi rad" ne smije značiti pitanje
-- korisniku gdje smo stali — odgovor je u podacima.

create or replace view public.v_sljedeca_stavka
with (security_invoker = true) as
select distinct on (p.rad_id)
       p.rad_id, p.id as stavka_id, p.oznaka, p.naslov, p.sto, p.izvori, p.stranice
from public.plan_stavke p
where p.status = 'nije-napisano'
order by p.rad_id, p.redoslijed;


-- ------------------------------------------------------------- napredak
create or replace view public.v_napredak
with (security_invoker = true) as
select r.id as rad_id,
       r.tema,
       r.rok,
       r.rok - current_date                                    as dana_do_roka,
       count(p.*)                                              as stavki,
       count(p.*) filter (where p.status in ('napisano', 'odobreno')) as gotovo,
       coalesce(sum(p.rijeci), 0)                              as rijeci,
       (select count(*) from public.zamjerke z
         where z.rad_id = r.id and not z.rijeseno)             as otvorenih_zamjerki,
       (select count(*) from public.nalazi n
         where n.rad_id = r.id and not n.rijeseno
           and n.razina = 'KRITICNO')                          as kriticnih_nalaza
from public.radovi r
left join public.plan_stavke p on p.rad_id = r.id
where not r.arhiviran
group by r.id;


-- ------------------------------------------------------------------ RLS
-- Svaka tablica. Vlasništvo se izvodi iz `radovi.user_id` — jedno mjesto istine,
-- pa se ne može dogoditi da nova tablica „zaboravi" tko je vlasnik.

alter table public.radovi           enable row level security;
alter table public.verzije          enable row level security;
alter table public.plan_stavke      enable row level security;
alter table public.plan_odstupanja  enable row level security;
alter table public.zamjerke         enable row level security;
alter table public.nalazi           enable row level security;
alter table public.mjere            enable row level security;
alter table public.profil_autora    enable row level security;

create policy radovi_vlasnik on public.radovi
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy profil_vlasnik on public.profil_autora
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Tablice vezane na rad: isti uvjet, generiran da se ne prepisuje ručno.
do $$
declare t text;
begin
  foreach t in array array['verzije', 'plan_stavke', 'zamjerke', 'nalazi', 'mjere']
  loop
    execute format($f$
      create policy %1$s_vlasnik on public.%1$s
        for all using (exists (select 1 from public.radovi r
                                where r.id = %1$s.rad_id
                                  and r.user_id = (select auth.uid())))
        with check (exists (select 1 from public.radovi r
                             where r.id = %1$s.rad_id
                               and r.user_id = (select auth.uid())));
    $f$, t);
  end loop;
end $$;

-- Odstupanja: SELECT i INSERT, bez UPDATE i DELETE.
-- Dnevnik koji se može prepraviti nije dnevnik (željezno pravilo 6).
create policy odstupanja_citaj on public.plan_odstupanja
  for select using (exists (
    select 1 from public.plan_stavke s
    join public.radovi r on r.id = s.rad_id
    where s.id = plan_odstupanja.stavka_id and r.user_id = (select auth.uid())));

create policy odstupanja_dodaj on public.plan_odstupanja
  for insert with check (exists (
    select 1 from public.plan_stavke s
    join public.radovi r on r.id = s.rad_id
    where s.id = plan_odstupanja.stavka_id and r.user_id = (select auth.uid())));


-- ------------------------------------------------------- zatvaranje zamjerke
-- Jedini put kojim se zamjerka zatvara. Postoji da `rijeseno_at` i dokaz ne mogu
-- razići, i da se zatvaranje ne može izvesti UPDATE-om koji preskoči dokaz.

create or replace function public.zatvori_zamjerku(p_id uuid, p_kako text)
returns public.zamjerke
language plpgsql
security invoker
as $$
declare
  z public.zamjerke;
begin
  if p_kako is null or length(btrim(p_kako)) < 10 then
    raise exception 'Zamjerka se ne zatvara bez dokaza: opisi KAKO je rijesena (min 10 znakova)'
      using errcode = 'check_violation';
  end if;
  update public.zamjerke
     set rijeseno = true, kako_rijeseno = btrim(p_kako), rijeseno_at = now()
   where id = p_id
  returning * into z;
  if z.id is null then
    raise exception 'Nema zamjerke % (ili nije tvoja)', p_id using errcode = 'no_data_found';
  end if;
  return z;
end;
$$;

comment on function public.zatvori_zamjerku is
  'Zatvara zamjerku uz obavezan dokaz. Nikad ne zatvaraj UPDATE-om izravno.';
