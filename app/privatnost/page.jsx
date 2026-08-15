import Link from 'next/link'
import { ThemeToggle } from '../theme-toggle'
import '../katedra-scoped.css'

export const metadata = {
  title: 'Politika privatnosti — Katedra',
}

export default function PrivatnostPage() {
  return (
    <div className="katedra-page legal-page" data-skin="kreda" style={{ minHeight: '100vh', padding: '0 16px 90px' }}>
      <div className="wrap legal-shell" style={{ maxWidth: 900 }}>
        <header className="legal-header">
          <Link href="/" className="legal-brand">
            <div className="logo-badge">K</div>
            <div>
              <strong className="legal-brand-title">Katedra</strong>
              <span className="legal-brand-subtitle">Od teme do Katedre</span>
            </div>
          </Link>
          <div className="legal-header-actions"><ThemeToggle /><Link href="/pisi" className="legal-header-action">Otvori aplikaciju</Link></div>
        </header>

        <main className="legal-main">
        <div className="legal-hero">
          <p className="legal-kicker">Dokument · Privatnost</p>
          <h1 className="legal-title">Politika privatnosti</h1>
          <p className="legal-meta">Zadnje ažurirano: [DATUM]. Vrijedi za uslugu Katedra dostupnu na katedra.hr.</p>
        </div>

        <div className="panel legal-alert" style={{ background: 'var(--warn)', color: '#2a1a00', marginBottom: 20, fontWeight: 700 }}>
          ⚠ NACRT — zahtijeva pravnu provjeru prije objave. Ovaj tekst nije pravni savjet niti ga
          je sastavio odvjetnik — istražen je i ojačan konkretnim izvorima (v. dno stranice), ali
          to ne zamjenjuje pravnu reviziju. Ne aktivirati naplatu korisnicima dok stranica ne
          prođe pravnu reviziju i dok se ne popune sva polja u uglatim zagradama.
        </div>

        <Link href="/pisi" className="legal-back">← Natrag na Katedru</Link>

        <div className="panel legal-document" style={{ marginTop: 20, lineHeight: 1.6 }}>
          <h2>1. Voditelj obrade podataka</h2>
          <p>
            [PRAVNI NAZIV OBRTA/TVRTKE], [OIB], [ADRESA SJEDIŠTA], Hrvatska
            (u daljnjem tekstu: &bdquo;Katedra&rdquo; ili &bdquo;mi&rdquo;).
            Za sva pitanja o privatnosti: <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>.
          </p>

          <h2>2. Koje podatke prikupljamo</h2>
          <ul>
            <li><b>Podaci računa:</b> e-mail adresa i lozinka (lozinku obrađuje Supabase Auth — mi je nikad ne vidimo u čitljivom obliku).</li>
            <li><b>Sadržaj rada:</b> tema, upute fakulteta, napomene, poruke koje upišeš u chat i AI odgovori — dok koristiš &bdquo;Piši ovdje&rdquo; unutar aplikacije. Prije prvog razgovora prikazujemo jednokratnu obavijest da koristimo generativnu umjetnu inteligenciju.</li>
            <li><b>Prilozi:</b> datoteke koje priložiš u chatu (PDF, slike, Word/.docx dokumenti). .docx datoteke obrađujemo <b>privremeno, u memoriji poslužitelja</b>, isključivo radi izdvajanja teksta za AI odgovor — ne spremamo trajnu kopiju priloženog dokumenta.</li>
            <li><b>Napredak i postavke:</b> checklist, faze, odabrani fakultet i status AI dopuštenja tvoje ustanove — najvećim dijelom lokalno u tvom pregledniku (localStorage). Prijavljenima se na račun šalju samo projektni metapodaci radi provjere vlasništva i Passa; tekst rukopisa, mentorove upute, izvori i AI prijedlozi ostaju na ovom uređaju i trenutačno se ne mogu nastaviti na drugom uređaju.</li>
            <li><b>Podaci o plaćanju:</b> Stripe obrađuje podatke kartice izravno — mi vidimo samo iznos, status transakcije i identifikator narudžbe, nikad broj kartice. Kupnja Pass paketa vezuje se uz konkretan projekt (radi jednog rada).</li>
            <li><b>Tehnički podaci:</b> IP adresa i standardni podaci poslužiteljskih logova, radi sigurnosti i sprječavanja zlouporabe.</li>
          </ul>

          <h2>3. Zašto obrađujemo tvoje podatke</h2>
          <ul>
            <li>Pružanje usluge — vođenje kroz proces izrade rada, AI odgovori u skladu s AI politikom tvoje ustanove, praćenje napretka (izvršenje ugovora).</li>
            <li>Naplata Pass paketa (izvršenje ugovora, zakonska obveza izdavanja računa).</li>
            <li>Sigurnost i sprječavanje zlouporabe (legitimni interes).</li>
            <li>Poboljšanje usluge putem anonimizirane/agregirane statistike (legitimni interes). [PROVJERITI: treba li ovo zasebnu privolu.]</li>
          </ul>

          <h2>4. Kome prosljeđujemo podatke (izvršitelji obrade)</h2>
          <p>Ne prodajemo tvoje podatke. Dijelimo ih samo s pružateljima koji nam pomažu izvršiti uslugu, od kojih svaki javno objavljuje standardni DPA (Data Processing Agreement) koji uključuje EU Standardne ugovorne klauzule (SCC) za prijenos podataka izvan EU/EGP-a:</p>
          <ul>
            <li><b>Supabase</b> — baza podataka, autentifikacija i hosting korisničkog stanja (dijeljena s Lekta proizvodom za isti akademski projekt kad koristiš oba). DPA: <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>supabase.com/legal/dpa</a>. Supabase nudi hosting u EU regiji (eu-central-1) — [PROVJERITI je li Katedra/Lekta projekt stvarno konfiguriran na EU regiju; ako nije, podaci se pohranjuju izvan EU/EGP-a i to treba ovdje jasno pisati].</li>
            <li><b>Stripe</b> — obrada plaćanja. DPA: <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>stripe.com/legal/dpa</a>, popis pod-izvršitelja: <a href="https://stripe.com/legal/service-providers" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>stripe.com/legal/service-providers</a>.</li>
            <li><b>Anthropic (AI dobavljač, trenutno Claude modeli)</b> — sadržaj koji upišeš u &bdquo;Piši ovdje&rdquo; i priložene datoteke šalju se ovom pružatelju isključivo radi generiranja AI odgovora, u vrijeme dok traje ta radnja. Anthropicova infrastruktura je pretežno u SAD-u — obrada putem Claude API-ja znači <b>prijenos podataka u treću zemlju</b> čak i uz eventualno uključenu EU rezidenciju za pohranu; DPA (uključuje 2021 EU SCC) automatski je dio komercijalnih uvjeta za Claude API/Enterprise.</li>
          </ul>
          <p style={{ color: 'var(--warn)' }}>
            [PRAVNIK: gornji DPA-ovi su standardni javni uvjeti svakog dobavljača — potvrditi (a) da
            je Katedrin/Lektin račun kod svakog stvarno na planu/uvjetima koji taj DPA pokrivaju
            (ne besplatni/hobby tier bez DPA pokrića), (b) je li potreban zaseban potpisani DPA uz
            standardne uvjete za bilo kojeg od njih, i (c) je li potrebna dodatna mjera prijenosa
            (SCC dopuna, TIA) posebno za Anthropic s obzirom na obradu izvan EU.]
          </p>

          <h2>5. Razdoblje čuvanja</h2>
          <ul>
            <li>Podaci računa i sadržaj rada: dok postoji tvoj korisnički račun ili dok ga ne zatražiš obrisati.</li>
            <li>Priložene .docx datoteke: nisu trajno pohranjene — brišu se odmah nakon obrade zahtjeva.</li>
            <li>Podaci o transakcijama: knjigovodstvene isprave (računi i evidencije prometa) čuvaju se najmanje <b>11 godina</b> po Zakonu o računovodstvu, računajući od zadnjeg dana poslovne godine na koju se odnose; eRačuni 6 godina. [PRAVNIK: potvrditi primjenjuje li se 11-godišnji rok na sve podatke o transakciji koje Katedra vodi, ili samo na formalne knjigovodstvene isprave.]</li>
          </ul>

          <h2>6. Tvoja prava</h2>
          <p>
            Imaš pravo na pristup, ispravak, brisanje i prenosivost svojih podataka, pravo na
            prigovor te pravo povući privolu u svakom trenutku (bez utjecaja na zakonitost obrade
            prije povlačenja). Zahtjev šalji na <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>.
            Imaš i pravo podnijeti pritužbu Agenciji za zaštitu osobnih podataka (AZOP).
          </p>

          <h2>7. Kolačići i lokalna pohrana</h2>
          <p>
            Katedra koristi localStorage tvog preglednika za pamćenje napretka, postavki i statusa
            AI dopuštenja bez posebnih kolačića za praćenje. Prijava koristi nužne Supabase
            autentifikacijske kolačiće potrebne za rad usluge.
          </p>

          <h2>8. Sigurnost</h2>
          <p>
            Podaci se prenose putem šifrirane veze (HTTPS). AI ključ i drugi tajni podaci nikad
            ne napuštaju poslužitelj niti se ne šalju u preglednik.
          </p>

          <h2>9. Izmjene ove politike</h2>
          <p>
            O značajnim izmjenama obavijestit ćemo te e-mailom ili obavijesti unutar aplikacije
            prije nego stupe na snagu.
          </p>

          <h2>10. Kontakt</h2>
          <p>
            [ADRESA], e-mail: <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>
          </p>
        </div>

        <div className="panel legal-sources" style={{ marginTop: 20, fontSize: 12, color: 'var(--mut)', lineHeight: 1.6 }}>
          <b>Izvori korišteni pri pisanju ovog nacrta</b> (provjereno kolovoz 2026 — prije objave provjeriti nisu li se propisi/uvjeti dobavljača u međuvremenu promijenili):
          <ul style={{ marginTop: 6 }}>
            <li>Supabase DPA — <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>supabase.com/legal/dpa</a></li>
            <li>Stripe DPA i popis pod-izvršitelja — <a href="https://stripe.com/legal/dpa" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>stripe.com/legal/dpa</a>, <a href="https://stripe.com/legal/service-providers" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>stripe.com/legal/service-providers</a></li>
            <li>Anthropic DPA / GDPR (komercijalni uvjeti Claude API-ja i Enterprisea, EU SCC) — pregled treće strane: <a href="https://compound.law/en-DE/tools/anthropic-api/" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>compound.law</a></li>
            <li>Zakon o računovodstvu — rokovi čuvanja knjigovodstvene dokumentacije — <a href="https://www.teb.hr/novosti/2026/cuvanje-racuna-i-knjigovodstvene-dokumentacije/" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>teb.hr</a></li>
          </ul>
        </div>

        <p className="legal-footer-links" style={{ marginTop: 20 }}>
          <Link href="/uvjeti" style={{ color: 'var(--acc)' }}>Uvjeti korištenja →</Link>
        </p>
        </main>
      </div>
    </div>
  )
}
