'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { ThemeToggle } from '../theme-toggle'
import '../katedra-scoped.css'

const numberFormat = new Intl.NumberFormat('hr-HR')

export default function AdminPage() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/admin/overview', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Admin pregled nije dostupan.')
        if (active) setOverview(body)
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const projects = Array.isArray(overview?.projects) ? overview.projects : []
  const runs = Array.isArray(overview?.agentRuns) ? overview.agentRuns : []
  const usage = overview?.usage
  const flags = overview?.featureFlags || {}

  return (
    <div className="katedra-page" style={{ minHeight: '100vh', padding: '28px 16px 90px' }}>
      <main className="wrap" style={{ maxWidth: 1080 }}>
        <div className="theme-utility-row">
          <Link href="/racun" style={{ color: 'var(--acc)', fontSize: 13 }}>← Natrag na račun</Link>
          <ThemeToggle />
        </div>

        <header className="admin-page-header">
          <p className="pis-kicker">Katedra / interni pregled</p>
          <h1>Admin pregled</h1>
          <p className="admin-page-lede">Operativni status tvog računa, projekata, agent runova i zaštitnih zastavica.</p>
        </header>

        {loading && <p role="status">Učitavam admin pregled…</p>}
        {error && <div className="panel" role="alert"><h2>Pristup nije dostupan</h2><p>{error}</p><Link href="/pisi">Natrag na Katedru</Link></div>}

        {overview && !error && (
          <>
            <section className="panel admin-identity" aria-labelledby="admin-identity-title">
              <div>
                <p className="pis-kicker">Potvrđeni pristup</p>
                <h2 id="admin-identity-title">Operativni pregled</h2>
                <p>{overview.user?.email || 'E-mail nije dostupan'}</p>
              </div>
              <span className="admin-access-badge">Override aktivan</span>
            </section>

            <section className="admin-metric-grid" aria-label="Sažetak">
              <Metric label="Projekti" value={projects.length} />
              <Metric label="Agent runovi" value={runs.length} />
              <Metric label="AI zahtjevi" value={usage?.requests ?? '—'} />
              <Metric label="Naplaćeni korisnički charge" value={usage ? numberFormat.format(usage.charged) : '—'} />
            </section>

            <div className="admin-content-grid">
              <section className="panel" aria-labelledby="admin-projects-title">
                <div className="admin-section-heading">
                  <div><p className="pis-kicker">Vlasnički podaci</p><h2 id="admin-projects-title">Projekti</h2></div>
                  <span>{projects.length}</span>
                </div>
                {projects.length === 0
                  ? <p role="status">Nema projekata.</p>
                  : <ul className="admin-list">{projects.map((project) => (
                    <li key={project.project_id}>
                      <div><strong>{project.topic || 'Rad bez naslova'}</strong><small>{project.work_type_canonical || project.work_type || 'Projekt'} · {project.deadline || 'Bez roka'}</small></div>
                      <Link href={`/pisi?projectId=${encodeURIComponent(project.project_id)}`}>Otvori</Link>
                    </li>
                  ))}</ul>}
              </section>

              <section className="panel" aria-labelledby="admin-runs-title">
                <div className="admin-section-heading">
                  <div><p className="pis-kicker">Canonical run state</p><h2 id="admin-runs-title">Agent runovi</h2></div>
                  <span>{runs.length}</span>
                </div>
                {runs.length === 0
                  ? <p role="status">Nema zabilježenih runova.</p>
                  : <ul className="admin-list">{runs.map((run) => <li key={run.run_id}><div><strong>{run.mode || 'Run'}</strong><small>{run.project_id} · {run.status || 'nepoznato'}</small></div><span data-status={run.status}>{run.status || '—'}</span></li>)}</ul>}
              </section>
            </div>

            <section className="panel admin-flags" aria-labelledby="admin-flags-title">
              <div className="admin-section-heading"><div><p className="pis-kicker">Deployment safety</p><h2 id="admin-flags-title">Feature zastavice</h2></div><span>{flags.billingContract}</span></div>
              <div className="admin-flag-list">
                <Flag label="Project locks" enabled={flags.projectLocks} />
                <Flag label="Agent runs" enabled={flags.agentRuns} />
                <Flag label="Materials" enabled={flags.materials} />
              </div>
              {Array.isArray(overview.warnings) && overview.warnings.map((warning) => <p key={warning} className="admin-warning" role="status">{warning}</p>)}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Metric({ label, value }) {
  return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>
}

function Flag({ label, enabled }) {
  return <div className="admin-flag"><span>{label}</span><strong data-state={enabled ? 'on' : 'off'}>{enabled ? 'Uključeno' : 'Isključeno'}</strong></div>
}
