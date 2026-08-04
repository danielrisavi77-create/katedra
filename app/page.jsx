import Link from 'next/link'
import './katedra-scoped.css'

export default function LandingPage() {
  return (
    <div className="katedra-page" data-skin="kreda" style={{ minHeight: '100vh', padding: '26px 16px 90px' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="logo-badge">K</div>
            <div>
              <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Katedra</h1>
              <p style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 1 }}>Od teme do obrane</p>
            </div>
          </div>
          <Link href="/prijava" style={{ color: 'var(--acc)', fontSize: 13.5, fontWeight: 700 }}>Prijavi se</Link>
        </header>

        {/* HERO */}
        <section style={{ marginTop: 48, marginBottom: 40, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, letterSpacing: '-.5px', lineHeight: 1.15, maxWidth: 720, margin: '0 auto' }}>
            Završi rad bez nagađanja.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--mut)', marginTop: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
            Katedra te vodi od teme do obrane — prati što je još otvoreno, što tvoj fakultet
            dopušta uz AI i što mentor čeka. Lekta provjerava stvarni dokument prije predaje.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <Link href="/pisi" className="copy-btn" style={{ width: 'auto', flex: '1 1 220px', maxWidth: 320, padding: '13px 26px', textDecoration: 'none' }}>
              Počni pisati →
            </Link>
            <Link href="/pisi?screen=scan" className="onb-back" style={{ marginTop: 0, flex: '1 1 220px', maxWidth: 380, justifyContent: 'center', padding: '13px 20px', fontSize: 13.5, textDecoration: 'none' }}>
              Provjeri gdje stoji tvoj rad — bez prijave
            </Link>
          </div>
        </section>

        {/* TRUST LINE — namjerno lakši tretman (bez .panel okvira) da se
            vizualno izdvoji kao izjava, ne kao još jedna kartica */}
        <section style={{ textAlign: 'center', marginBottom: 40, padding: '22px 16px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: 16.5 }}>AI se prilagođava pravilima tvog projekta — ne obrnuto.</h3>
          <p style={{ fontSize: 13.5, color: 'var(--mut)', marginTop: 6, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Katedra prvo provjerava što ti je dopušteno prema objavljenim pravilima tvog
            fakulteta — tek onda uključuje AI. Kad pravilo nije potvrđeno, Katedra ostaje na
            sigurnijoj strani i vodi te pitanjima umjesto da piše umjesto tebe.
          </p>
        </section>

        {/* KAKO RADI — čist numerirani niz, bez kartica, da se razlikuje od
            cijena ispod (te ostaju kartice jer se stvarno uspoređuju) */}
        <section style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mut2)', textAlign: 'center', marginBottom: 22 }}>
            Kako radi — 3 koraka
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>1</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Odgovori na par pitanja u chatu</b> — koji rad, koja tema, kad je rok. Vodi te
                korak po korak, ništa ne moraš znati unaprijed.
              </p>
            </div>
            <div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>2</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Dodaj datoteke</b> — app ti kaže točno što pomaže: upute fakulteta, literatura,
                postojeći draft. Nemaš nešto? Preskoči, radi i bez toga.
              </p>
            </div>
            <div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--acc)', color: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, marginBottom: 10 }}>3</div>
              <p style={{ fontSize: 13.8, lineHeight: 1.5 }}>
                <b>Pišeš ovdje</b> — prvo detaljan plan, zatim pisanje uz tvoje odobravanje svakog
                koraka, prilagođeno AI pravilima tvog fakulteta. Prije predaje, Lekta provjerava
                stvarni dokument.
              </p>
            </div>
          </div>
        </section>

        {/* CIJENE — ostaje kartica-tretman (.panel): ovdje se stvarno uspoređuju 3 opcije */}
        <section style={{ marginBottom: 36 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mut2)', textAlign: 'center', marginBottom: 22 }}>
            Jedna kupnja, jedan rad
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="panel" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Seminarski Pass</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--acc)', margin: '6px 0' }}>29,90 €</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>~1 seminarski s revizijama</div>
            </div>
            <div className="panel" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Završni Pass</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--acc)', margin: '6px 0' }}>79,90 €</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>~1 završni + recenzija</div>
            </div>
            <div className="panel" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Diplomski Pass</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--acc)', margin: '6px 0' }}>129,90 €</div>
              <div style={{ fontSize: 12, color: 'var(--mut)' }}>diplomski rad</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--mut2)', textAlign: 'center', marginTop: 12 }}>
            Pass otključava Katedru i Lektu za taj konkretan rad. Plan i program te Lekta
            provjera ostaju besplatni bez kupnje.
          </p>
        </section>

        {/* FINALNI CTA */}
        <section style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/pisi" className="copy-btn" style={{ width: 'auto', padding: '13px 26px', textDecoration: 'none', display: 'inline-flex' }}>
            Počni pisati →
          </Link>
        </section>

        <footer style={{ borderTop: '1px solid var(--line)', paddingTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', fontSize: 12.5 }}>
          <Link href="/privatnost" style={{ color: 'var(--mut)' }}>Politika privatnosti</Link>
          <Link href="/uvjeti" style={{ color: 'var(--mut)' }}>Uvjeti korištenja</Link>
          <Link href="/prijava" style={{ color: 'var(--mut)' }}>Prijava</Link>
          <a href="mailto:podrska@katedra.hr" style={{ color: 'var(--mut)' }}>podrska@katedra.hr</a>
        </footer>
      </div>
    </div>
  )
}
