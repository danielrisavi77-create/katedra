import Link from 'next/link'
import '../katedra-scoped.css'

export const metadata = {
  title: 'Politika privatnosti — Katedra',
}

export default function PrivatnostPage() {
  return (
    <div className="katedra-page" style={{ minHeight: '100vh', padding: '40px 16px 90px' }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="panel" style={{ background: 'var(--warn)', color: '#2a1a00', marginBottom: 20, fontWeight: 700 }}>
          ⚠ NACRT — zahtijeva pravnu provjeru prije objave. Ovaj tekst nije pravni savjet i još
          nije potvrđen od strane odvjetnika. Ne aktivirati naplatu korisnicima dok ova stranica
          ne prođe pravnu reviziju i dok se ne popune sva polja u uglatim zagradama.
        </div>

        <Link href="/" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na Katedru</Link>
        <h1 style={{ marginTop: 16 }}>Politika privatnosti</h1>
        <p style={{ color: 'var(--mut)' }}>Zadnje ažurirano: [DATUM]. Vrijedi za uslugu Katedra dostupnu na katedra.hr.</p>

        <div className="panel" style={{ marginTop: 20, lineHeight: 1.6 }}>
          <h3>1. Voditelj obrade podataka</h3>
          <p>
            [PRAVNI NAZIV OBRTA/TVRTKE], [OIB], [ADRESA SJEDIŠTA], Hrvatska
            (u daljnjem tekstu: &bdquo;Katedra&rdquo; ili &bdquo;mi&rdquo;).
            Za sva pitanja o privatnosti: <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>.
          </p>

          <h3>2. Koje podatke prikupljamo</h3>
          <ul>
            <li><b>Podaci računa:</b> e-mail adresa i lozinka (lozinku obrađuje Supabase Auth — mi je nikad ne vidimo u čitljivom obliku).</li>
            <li><b>Sadržaj rada:</b> tema, upute fakulteta, napomene, poruke koje upišeš u chat i AI odgovori — dok koristiš &bdquo;Piši ovdje&rdquo; unutar aplikacije. Prije prvog razgovora prikazujemo jednokratnu obavijest da koristimo generativnu umjetnu inteligenciju.</li>
            <li><b>Prilozi:</b> datoteke koje priložiš u chatu (PDF, slike, Word/.docx dokumenti). .docx datoteke obrađujemo <b>privremeno, u memoriji poslužitelja</b>, isključivo radi izdvajanja teksta za AI odgovor — ne spremamo trajnu kopiju priloženog dokumenta.</li>
            <li><b>Napredak i postavke:</b> checklist, faze, odabrani fakultet i status AI dopuštenja tvoje ustanove — najvećim dijelom lokalno u tvom pregledniku (localStorage); prijavljenima se sinkronizira na račun radi nastavka rada na drugom uređaju. Slobodan tekst (npr. mentorove upute, tekst za poboljšanje, istraživačko pitanje) namjerno <b>ne</b> sinkroniziramo na server — ostaje samo u tvom pregledniku.</li>
            <li><b>Podaci o plaćanju:</b> Stripe obrađuje podatke kartice izravno — mi vidimo samo iznos, status transakcije i identifikator narudžbe, nikad broj kartice. Kupnja Pass paketa vezuje se uz konkretan projekt (radi jednog rada).</li>
            <li><b>Tehnički podaci:</b> IP adresa i standardni podaci poslužiteljskih logova, radi sigurnosti i sprječavanja zlouporabe.</li>
          </ul>

          <h3>3. Zašto obrađujemo tvoje podatke</h3>
          <ul>
            <li>Pružanje usluge — vođenje kroz proces izrade rada, AI odgovori u skladu s AI politikom tvoje ustanove, praćenje napretka (izvršenje ugovora).</li>
            <li>Naplata Pass paketa (izvršenje ugovora, zakonska obveza izdavanja računa).</li>
            <li>Sigurnost i sprječavanje zlouporabe (legitimni interes).</li>
            <li>Poboljšanje usluge putem anonimizirane/agregirane statistike (legitimni interes). [PROVJERITI: treba li ovo zasebnu privolu.]</li>
          </ul>

          <h3>4. Kome prosljeđujemo podatke (izvršitelji obrade)</h3>
          <p>Ne prodajemo tvoje podatke. Dijelimo ih samo s pružateljima koji nam pomažu izvršiti uslugu:</p>
          <ul>
            <li><b>Supabase</b> — baza podataka, autentifikacija i hosting korisničkog stanja (dijeljena s Lekta proizvodom za isti akademski projekt kad koristiš oba).</li>
            <li><b>Stripe</b> — obrada plaćanja.</li>
            <li><b>Anthropic (AI dobavljač, trenutno Claude modeli)</b> — sadržaj koji upišeš u &bdquo;Piši ovdje&rdquo; i priložene datoteke šalju se ovom pružatelju isključivo radi generiranja AI odgovora, u vrijeme dok traje ta radnja.</li>
          </ul>
          <p style={{ color: 'var(--warn)' }}>
            [PRAVNIK: potvrditi postoji li potpisan DPA (Data Processing Agreement) sa svakim od gornjih
            izvršitelja te obrađuju li koji od njih podatke izvan EU/EGP-a — ako da, treba navesti
            mehanizam prijenosa (npr. Standardne ugovorne klauzule).]
          </p>

          <h3>5. Razdoblje čuvanja</h3>
          <ul>
            <li>Podaci računa i sadržaj rada: dok postoji tvoj korisnički račun ili dok ga ne zatražiš obrisati.</li>
            <li>Priložene .docx datoteke: nisu trajno pohranjene — brišu se odmah nakon obrade zahtjeva.</li>
            <li>Podaci o transakcijama: [PRAVNIK: rok čuvanja po poreznim propisima, obično 11 godina za knjigovodstvene isprave u RH].</li>
          </ul>

          <h3>6. Tvoja prava</h3>
          <p>
            Imaš pravo na pristup, ispravak, brisanje i prenosivost svojih podataka, pravo na
            prigovor te pravo povući privolu u svakom trenutku (bez utjecaja na zakonitost obrade
            prije povlačenja). Zahtjev šalji na <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>.
            Imaš i pravo podnijeti pritužbu Agenciji za zaštitu osobnih podataka (AZOP).
          </p>

          <h3>7. Kolačići i lokalna pohrana</h3>
          <p>
            Katedra koristi localStorage tvog preglednika za pamćenje napretka, postavki i statusa
            AI dopuštenja bez posebnih kolačića za praćenje. Prijava koristi nužne Supabase
            autentifikacijske kolačiće potrebne za rad usluge.
          </p>

          <h3>8. Sigurnost</h3>
          <p>
            Podaci se prenose putem šifrirane veze (HTTPS). AI ključ i drugi tajni podaci nikad
            ne napuštaju poslužitelj niti se ne šalju u preglednik.
          </p>

          <h3>9. Izmjene ove politike</h3>
          <p>
            O značajnim izmjenama obavijestit ćemo te e-mailom ili obavijesti unutar aplikacije
            prije nego stupe na snagu.
          </p>

          <h3>10. Kontakt</h3>
          <p>
            [ADRESA], e-mail: <a href="mailto:privatnost@katedra.hr" style={{ color: 'var(--acc)' }}>privatnost@katedra.hr</a>
          </p>
        </div>

        <p style={{ marginTop: 20 }}>
          <Link href="/uvjeti" style={{ color: 'var(--acc)' }}>Uvjeti korištenja →</Link>
        </p>
      </div>
    </div>
  )
}
