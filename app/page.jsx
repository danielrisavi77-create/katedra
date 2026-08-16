import Link from 'next/link'
import './katedra-scoped.css'
import LandingMotion from './landing-motion'
import { ThemeToggle } from './theme-toggle'

// Cijene su klikabilne — svaka vodi ravno u wizard s već pretpostavljenim
// tipom rada (?tip=s|z|d preskače pitanje "koji rad pišeš"). Ne vodi izravno
// na Stripe: kupnja zahtijeva prijavu i postojeći projekt (academic_project_id,
// Audit 4), pa je najpošteniji izravan korak "kreni od tog tipa rada", ne
// lažna "kupi odmah" tipka koja bi svejedno morala prvo tražiti prijavu.
const PASSES = [
  { tip: 's', name: 'Seminarski Pass', price: '29,90 €', desc: 'plan, izvori, pisanje i sadržajna revizija' },
  { tip: 'z', name: 'Završni Pass', price: '79,90 €', desc: 'istraživačko pitanje, metodologija i mentorov workflow' },
  { tip: 'd', name: 'Diplomski Pass', price: '129,90 €', desc: 'istraživački dizajn, više revizija i priprema obrane' },
]

export default function LandingPage() {
  return (
    <div className="katedra-page landing-page" data-skin="kreda" data-landing-motion="true" style={{ minHeight: '100vh', padding: '26px 16px 90px' }}>
      <LandingMotion />
      <div className="wrap landing-wrap" style={{ maxWidth: 980 }}>
        <header className="landing-header" data-reveal="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="landing-brand" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="logo-badge">K</div>
            <div>
              <h1 className="landing-brand-title" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Katedra</h1>
              <p className="landing-brand-subtitle" style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 1 }}>Od teme do obrane</p>
            </div>
          </div>
          <div className="landing-header-actions"><ThemeToggle /><Link href="/prijava" style={{ color: 'var(--acc)', fontSize: 13.5, fontWeight: 700 }}>Prijavi se</Link></div>
        </header>

        <main>
        {/* HERO */}
        <section className="landing-hero" data-reveal="true" style={{ marginTop: 48, marginBottom: 40, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, letterSpacing: '-.5px', lineHeight: 1.15, maxWidth: 720, margin: '0 auto' }}>
            Završi rad bez nagađanja.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--mut)', marginTop: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
            Katedra te vodi od teme do obrane, prati što je još otvoreno, što tvoj fakultet
            dopušta uz AI i što mentor čeka. Lekta provjerava stvarni dokument prije predaje.
          </p>
          <div className="landing-actions" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            {/* Obični <a>, ne next/link: /pisi ima BOOT <script> koji čita ?screen=/
                ?tip= prije prvog painta da izbjegne flash krivog ekrana — taj script
                tag se ne izvršava kod React client-side navigacije (Link), samo kod
                pravog učitavanja stranice. */}
            {/* Eksplicitna height (ne samo padding+line-height): .copy-btn i .onb-back
                imaju različit naslijeđeni line-height, pa bi se inače ipak razlikovale
                visine iako je width isti — provjereno mjerenjem u pravom browseru. */}
            <a href="/pisi" className="copy-btn landing-primary-cta" style={{ width: 260, height: 48, maxWidth: '100%', padding: '0 20px', fontSize: 14, textDecoration: 'none' }}>
              Počni pisati →
            </a>
            <a href="/pisi?screen=scan" className="onb-back landing-secondary-cta" style={{ width: 260, height: 48, maxWidth: '100%', marginTop: 0, justifyContent: 'center', padding: '0 20px', textDecoration: 'none' }}>
              Provjeri bez prijave →
            </a>
          </div>
        </section>

        {/* TRUST LINE — namjerno lakši tretman (bez .panel okvira) da se
            vizualno izdvoji kao izjava, ne kao još jedna kartica */}
         <section className="landing-trust" data-reveal="true" style={{ textAlign: 'center', marginBottom: 40, padding: '22px 16px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 16.5 }}>AI se prilagođava pravilima tvog projekta, ne obrnuto.</h3>
          <p style={{ fontSize: 13.5, color: 'var(--mut)', marginTop: 6, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Katedra prvo provjerava što ti je dopušteno prema objavljenim pravilima tvog
            fakulteta. Tek onda uključuje AI. Kad pravilo nije potvrđeno, Katedra ostaje na
            sigurnijoj strani i vodi te pitanjima umjesto da piše umjesto tebe.
          </p>
         </section>

         <section className="landing-proof" data-reveal="true" aria-labelledby="landing-proof-title">
           <div className="landing-proof-intro">
             <p className="landing-proof-kicker">PROIZVOD U PRAKSI</p>
             <h3 id="landing-proof-title">Kako izgleda jedan projekt</h3>
             <p>Ne dobivaš samo odgovor u chatu. Dobivaš trag rada: što je pronađeno, što je provjereno, što još nedostaje i koji je sljedeći potez.</p>
             <strong>Ilustrativni FPZG projekt</strong>
           </div>
           <ol className="landing-proof-flow" aria-label="Primjer tijeka projekta">
             <li><span>01</span><b>Istraživanje</b><em>18 izvora pronađeno</em></li>
             <li><span>02</span><b>Provjera izvora</b><em>16 izvora potvrđeno</em></li>
             <li><span>03</span><b>Plan rada</b><em>6 poglavlja i istraživačko pitanje</em></li>
             <li><span>04</span><b>Lekta provjera</b><em>formalna provjera stvarnog DOCX-a</em></li>
           </ol>
           <p className="landing-proof-note">Primjer tijeka, ne jamstvo rezultata. Stvarni opseg ovisi o radu, materijalima i pravilima ustanove.</p>
         </section>

         {/* KAKO RADI — čist numerirani niz, bez kartica, da se razlikuje od
            cijena ispod (te ostaju kartice jer se stvarno uspoređuju) */}
        <section className="landing-steps" data-reveal="true" style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mut2)', textAlign: 'center', marginBottom: 22 }}>
            Kako radi: 3 koraka
          </h3>
          <div className="landing-step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            <div data-reveal="true">
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>1</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Odgovori na nekoliko pitanja o radu:</b> koji rad, koja tema, kad je rok. Vodi te
                korak po korak, ništa ne moraš znati unaprijed.
              </p>
            </div>
            <div data-reveal="true">
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>2</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Dodaj datoteke:</b> app ti kaže točno što pomaže: upute fakulteta, literatura,
                postojeći draft. Nemaš nešto? Preskoči, radi i bez toga.
              </p>
            </div>
            <div data-reveal="true">
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>3</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Pišeš ovdje:</b> prvo detaljan plan, zatim pisanje uz tvoje odobravanje svakog
                koraka, prilagođeno AI pravilima tvog fakulteta. Prije predaje, Lekta provjerava
                stvarni dokument.
              </p>
            </div>
          </div>
        </section>

        {/* CIJENE — ostaje kartica-tretman (.panel): ovdje se stvarno uspoređuju 3 opcije */}
        <section className="landing-pricing" data-reveal="true" style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mut2)', textAlign: 'center', marginBottom: 22 }}>
            Jedna kupnja, jedan rad
          </h3>
          <div className="landing-price-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {PASSES.map(p => (
              <a key={p.tip} href={`/pisi?tip=${p.tip}`} className="panel landing-pass-card" data-reveal="true" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--acc)', margin: '6px 0' }}>{p.price}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>{p.desc}</div>
                <div style={{ fontSize: 12, color: 'var(--acc)', fontWeight: 700, marginTop: 10 }}>Odaberi →</div>
              </a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mut2)', textAlign: 'center', marginTop: 12 }}>
            Pass otključava Katedru i Lektu za taj konkretan rad. Plan i program te Lekta
            provjera ostaju besplatni bez kupnje.
          </p>
        </section>

        {/* FINALNI CTA */}
        <section className="landing-final-cta" data-reveal="true" style={{ textAlign: 'center', marginBottom: 36 }}>
          <a href="/pisi" className="copy-btn landing-primary-cta" style={{ width: 'auto', padding: '13px 26px', textDecoration: 'none', display: 'inline-flex' }}>
            Počni pisati →
          </a>
        </section>

        </main>

        <footer className="landing-footer" data-reveal="true" style={{ borderTop: '1px solid var(--line)', paddingTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', fontSize: 12.5 }}>
          <Link href="/privatnost" style={{ color: 'var(--mut)' }}>Politika privatnosti</Link>
          <Link href="/uvjeti" style={{ color: 'var(--mut)' }}>Uvjeti korištenja</Link>
          <Link href="/prijava" style={{ color: 'var(--mut)' }}>Prijava</Link>
          <a href="mailto:podrska@katedra.hr" style={{ color: 'var(--mut)' }}>podrska@katedra.hr</a>
        </footer>
      </div>
    </div>
  )
}
