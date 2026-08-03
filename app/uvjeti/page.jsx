import Link from 'next/link'
import '../katedra-scoped.css'

export const metadata = {
  title: 'Uvjeti korištenja — Katedra',
}

export default function UvjetiPage() {
  return (
    <div className="katedra-page" style={{ minHeight: '100vh', padding: '40px 16px 90px' }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="panel" style={{ background: 'var(--warn)', color: '#2a1a00', marginBottom: 20, fontWeight: 700 }}>
          ⚠ NACRT — zahtijeva pravnu provjeru prije objave. Ovaj tekst nije pravni savjet niti ga
          je sastavio odvjetnik — istražen je i ojačan konkretnim izvorima (v. dno stranice), ali
          to ne zamjenjuje pravnu reviziju. §5 (pravo na odustajanje) sadrži i implementacijski
          nedostatak, ne samo tekstualni — v. napomenu unutra. Ne aktivirati naplatu korisnicima
          prije pravne revizije i prije nego funkcija raskida stvarno postoji u aplikaciji.
        </div>

        <Link href="/pisi" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na Katedru</Link>
        <h1 style={{ marginTop: 16 }}>Uvjeti korištenja</h1>
        <p style={{ color: 'var(--mut)' }}>Zadnje ažurirano: [DATUM]. Vrijedi za uslugu Katedra dostupnu na katedra.hr.</p>

        <div className="panel" style={{ marginTop: 20, lineHeight: 1.6 }}>
          <h3>1. Tko smo i što je Katedra</h3>
          <p>
            Katedra je digitalni kopilot koji vodi izradu jednog akademskog rada (seminarski,
            završni ili diplomski) od teme do obrane — istraživanje, struktura, pisanje uz AI
            asistenciju u skladu s AI politikom tvoje ustanove, verificirana pravila fakulteta i
            priprema obrane. Uslugu pruža [PRAVNI NAZIV OBRTA/TVRTKE], [OIB], [ADRESA], Hrvatska.
          </p>
          <p>
            Katedra <b>nije</b> tehnički/formalni validator dokumenta. Provjeru formalne
            usklađenosti stvarnog Word dokumenta (margine, fontovi, stilovi, citatna mehanika,
            TOC/SEQ/REF polja) isključivo provodi sestrinski proizvod <b>Lekta</b> — Katedra
            objašnjava Lekta nalaze i pomaže ih riješiti, ali ne izdaje vlastitu tehničku ocjenu.
          </p>

          <h3>2. Dobna granica i registracija</h3>
          <p>
            Uslugu smiju koristiti osobe s navršenih <b>18 godina</b>. Registracijom potvrđuješ da
            ispunjavaš ovaj uvjet i da su podaci koje navedeš točni.
          </p>

          <h3>3. Priroda usluge — AI asistencija, ne izrada rada umjesto tebe</h3>
          <p>
            Katedra je alat koji pomaže <i>tebi</i> napisati rad — ti biraš temu, odobravaš plan i
            svako poglavlje, provjeravaš izvore i braniš rad. Kada je AI politika tvoje ustanove
            poznata i ne dopušta generiranje gotovog teksta za predaju, Katedra to poštuje i
            umjesto pisanja nudi pitanja i strukturu. Odgovornost za akademsku čestitost, točnost
            navoda i poštivanje pravila tvog fakulteta o korištenju AI-ja ostaje na tebi. AI
            odgovori mogu sadržavati pogreške ili izmišljene navode — provjera je tvoja obveza.
          </p>

          <h3>4. Cijena i plaćanje</h3>
          <p>
            Cijene Pass paketa prikazane su u eurima na stranici kupnje. [PROVJERITI PDV STATUS:
            paušalni obrt ostaje izvan sustava PDV-a dok godišnji primici ne prijeđu 60.000 € —
            ako Katedra prodaje i potrošačima u drugim EU državama, prag za prijavu prodaje na
            daljinu (OSS sustav, tromjesečna prijava) je 10.000 € godišnje zbrojeno za cijelu EU;
            iznad praga PDV se obračunava po stopi države kupca. Cijene gore trebaju jasno
            navesti uključuje li iznos PDV, ovisno o statusu.] Plaćanje obrađuje Stripe (kartice,
            Apple/Google Pay). Naplata se izvršava odmah po dovršetku plaćanja, a Pass se
            aktivira automatski za taj konkretan rad (i za Katedru i za Lekta provjeru istog
            rada) nakon uspješne transakcije. Plan i program te Lekta provjera ostaju besplatni
            neovisno o Pass kupnji.
          </p>

          <h3>5. Pravo na jednostrani raskid ugovora (pravo na odustajanje)</h3>
          <p>
            Ako kupuješ kao potrošač, prema Zakonu o zaštiti potrošača imaš pravo, bez navođenja
            razloga, jednostrano raskinuti ugovor sklopljen na daljinu u roku od <b>14 dana</b> od
            dana sklapanja ugovora.
          </p>
          <p>
            <b>Od 19. lipnja 2026. ovo pravo moraš moći ostvariti izravno u aplikaciji, ne samo
            e-mailom.</b> Čl. 81.a Zakona o zaštiti potrošača (NN 59/2026, izmjene i dopune)
            trgovca koji sklapa ugovore na daljinu obvezuje na jasno vidljivu funkciju za
            jednostrani raskid — gumb s nedvosmislenom oznakom (npr. &bdquo;Jednostrani raskid
            ugovora&rdquo; ili &bdquo;Otkaži pretplatu&rdquo;), dostupan kroz cijelo razdoblje
            prava na raskid, koji vodi na kratki online obrazac; po potvrdi sustav automatski
            šalje potvrdu raskida na trajnom mediju (e-mail) s datumom i vremenom primitka
            zahtjeva. Sam e-mail zahtjev korisniku i dalje ostaje valjan način ostvarivanja prava
            (zakon ne ukida pravo na raskid drugim putem), ali <b>nedostatak samog gumba/forme u
            aplikaciji je zasebni prekršaj</b>, neovisno o tome je li se pojedini korisnik uopće
            požalio — Državni inspektorat provodi nadzor.
          </p>
          <p style={{ color: 'var(--warn)' }}>
            ⚠ [PRODUKT: ovo trenutno NIJE implementirano — Katedra danas ima samo e-mail kontakt
            za raskid (§5, §6), ne i gumb/formu u aplikaciji. Zakon je na snazi od 19.6.2026.,
            danas je [DATUM] — implementacija stvarne funkcije u aplikaciji je odvojen, hitan
            zadatak, ne samo izmjena ovog teksta.]
          </p>
          <p>
            <b>Iznimka koju moraš znati:</b> Pass ti daje pristup Katedra i Lekta radnom prostoru za
            taj rad odmah nakon plaćanja. Ako pri kupnji izričito zatražiš da usluga počne prije
            isteka roka od 14 dana i potvrdiš da si upoznat/a da time gubiš pravo na odustajanje
            čim je usluga u potpunosti izvršena (npr. čim iskoristiš Pass za ovaj rad), pravo na
            odustajanje prestaje u tom trenutku, u skladu sa zakonom.
          </p>
          <p style={{ color: 'var(--warn)' }}>
            [PRAVNIK: potvrditi (a) je li checkout consent checkbox (postojeći tekst: &bdquo;izričito
            zahtijevam da usluga počne odmah... razumijem da time gubim pravo na odustajanje&rdquo;)
            pravno dovoljan za ovu iznimku ili treba dodatnu formulaciju/obrazac uz njega, i (b)
            treba li se, s obzirom na §4 gornju iznimku, gumb za raskid iz ovog paragrafa uopće
            ikad realno aktivirati (ako pravo prestaje odmah pri kupnji) — ili gumb i dalje mora
            postojati za slučajeve kad korisnik NIJE potvrdio tu privolu.]
          </p>

          <h3>6. Katedrina politika povrata novca</h3>
          <p>
            Neovisno o zakonskom pravu na odustajanje iz §5, Katedrina interna politika je: <b>povrat
            novca odobravamo u slučaju tehničkog problema</b> (npr. usluga nije bila dostupna,
            naplaćeno je bez aktivacije Pass paketa). Izvan zakonskog roka za odustajanje ne
            odobravamo povrat zbog promjene mišljenja nakon što je Pass iskorišten. Zahtjev za
            povrat šalji na{' '}
            <a href="mailto:podrska@katedra.hr" style={{ color: 'var(--acc)' }}>podrska@katedra.hr</a>.
          </p>

          <h3>7. Poštena upotreba</h3>
          <p>
            Pass pokriva razuman opseg AI zadataka za jedan akademski rad. Zadržavamo pravo
            ograničiti ili obustaviti račun kod očite zlouporabe (npr. preprodaja pristupa,
            automatizirano iskorištavanje izvan namjene usluge).
          </p>

          <h3>8. Ograničenje odgovornosti</h3>
          <p>
            Katedra ne jamči određenu ocjenu, prolaznost ili ishod obrane. Usluga se pruža
            &bdquo;kakva jest&rdquo;, u mjeri dopuštenoj zakonom. Ne odgovaramo za posljedice
            oslanjanja na AI sadržaj bez vlastite provjere.
          </p>

          <h3>9. Intelektualno vlasništvo</h3>
          <p>
            Zadržavaš sva prava na temu, ideje i konačni tekst svog rada. Katedrin softver,
            dizajn i baza pravila fakulteta ostaju u našem vlasništvu.
          </p>

          <h3>10. Raskid računa</h3>
          <p>
            Račun možeš zatvoriti u svakom trenutku putem e-maila na podršku. Zadržavamo pravo
            obustaviti račun kod kršenja ovih uvjeta.
          </p>

          <h3>11. Mjerodavno pravo</h3>
          <p>Ovi uvjeti podliježu hrvatskom pravu. Za sporove je nadležan sud u Hrvatskoj, ne dovodeći u pitanje prisilne odredbe o zaštiti potrošača.</p>

          <h3>12. Izmjene uvjeta</h3>
          <p>O značajnim izmjenama obavijestit ćemo te prije nego stupe na snagu.</p>

          <h3>13. Kontakt</h3>
          <p>
            [ADRESA], e-mail: <a href="mailto:podrska@katedra.hr" style={{ color: 'var(--acc)' }}>podrska@katedra.hr</a>
          </p>
        </div>

        <div className="panel" style={{ marginTop: 20, fontSize: 12, color: 'var(--mut)', lineHeight: 1.6 }}>
          <b>Izvori korišteni pri pisanju ovog nacrta</b> (provjereno kolovoz 2026 — prije objave provjeriti nisu li se propisi u međuvremenu promijenili):
          <ul style={{ marginTop: 6 }}>
            <li>Zakon o izmjenama i dopunama Zakona o zaštiti potrošača, NN 59/2026, čl. 81.a — <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/full/2026_06_59_728.html" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>narodne-novine.hr</a></li>
            <li>HUZP, &bdquo;Gumb za jednostrani raskid ugovora&rdquo; — <a href="https://huzp.hr/gumb-za-jednostrani-raskid-ugovora/" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>huzp.hr</a></li>
            <li>PDV prag za paušalni obrt (60.000 €) i EU prag prodaje na daljinu/OSS (10.000 €) — <a href="https://www.datasmart.hr/savjeti/pdv-prag-2026-pausalni-obrt/" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>datasmart.hr</a>, <a href="https://www.fiskai.hr/vodic/oss-ioss-prodaja-na-daljinu/" target="_blank" rel="noopener" style={{ color: 'var(--acc)' }}>fiskai.hr</a></li>
          </ul>
        </div>

        <p style={{ marginTop: 20 }}>
          <Link href="/privatnost" style={{ color: 'var(--acc)' }}>← Politika privatnosti</Link>
        </p>
      </div>
    </div>
  )
}
