'use client'

import type { AgentRunMode, AgentSourcePolicy } from './agent-team-selector'

const processSteps = [
  {
    number: '01',
    title: 'Priprema i analiza materijala',
    detail: 'Katedra čita ono što si dodao i izdvaja temu, zahtjeve, ograničenja i otvorena pitanja.',
    actor: 'Agent za analizu materijala',
    verifier: 'Neovisna provjera konteksta',
  },
  {
    number: '02',
    title: 'Istraživanje i provjera izvora',
    detail: 'Izvori se razdvajaju od prijedloga, a činjenice bez provjerljivog dokaza ne prolaze dalje.',
    actor: 'Agent za literaturu',
    verifier: 'Neovisna provjera izvora',
  },
  {
    number: '03',
    title: 'Struktura i plan poglavlja',
    detail: 'Nastaje mapa rada: redoslijed poglavlja, argumenti, ciljevi i sljedeći konkretan korak.',
    actor: 'Agent za strukturu',
    verifier: 'Neovisna provjera plana',
  },
  {
    number: '04',
    title: 'Pisanje poglavlja',
    detail: 'Tekst se gradi po sekcijama. U vođenom načinu svaki veći prijedlog čeka tvoju odluku.',
    actor: 'Agent za pisanje',
    verifier: 'Neovisna provjera citata',
  },
  {
    number: '05',
    title: 'Pregled i Quality Gate',
    detail: 'Završni pregled traži rupe u argumentu, izvore, nedosljednosti i mjesta koja trebaš provjeriti.',
    actor: 'Agent za pregled',
    verifier: 'Neovisni quality gate',
  },
] as const

export function AgenticProcessPreview({ mode, sourcePolicy }: { mode: AgentRunMode; sourcePolicy: AgentSourcePolicy }) {
  return (
    <section className="pis-agentic-process-preview" aria-labelledby="pis-agentic-process-preview-title">
      <header className="pis-agentic-process-preview-heading">
        <div>
          <p className="pis-kicker">Pregled prije pokretanja</p>
          <h3 id="pis-agentic-process-preview-title">Kako nastaje tvoj rad</h3>
          <p>Katedra ne preskače izravno na završni tekst. Svaki korak ostavlja vidljiv trag, provjeru i odluku koju možeš pregledati.</p>
        </div>
        <span className="pis-agentic-preview-state">Plan procesa</span>
      </header>

      <ol className="pis-agentic-process-steps" aria-label="Plan agentičnog procesa">
        {processSteps.map((step) => (
          <li className="pis-agentic-process-step" key={step.number}>
            <span className="pis-agentic-process-marker" aria-hidden="true">{step.number}</span>
            <div className="pis-agentic-process-step-body">
              <div className="pis-agentic-process-step-title"><strong>{step.title}</strong><span>Planirano</span></div>
              <p>{step.detail}</p>
              <details className="pis-agentic-process-details">
                <summary>Tehnički detalji</summary>
                <div className="pis-agentic-process-roles"><span>{step.actor}</span><span aria-hidden="true">→</span><span>{step.verifier}</span></div>
              </details>
            </div>
          </li>
        ))}
      </ol>

      <footer className="pis-agentic-process-preview-footer">
        <span><b>Način:</b> {modeLabel(mode)}</span>
        <span><b>Izvori:</b> {sourcePolicyLabel(sourcePolicy)}</span>
        <span>Svaki rezultat prolazi zasebnu provjeru i može se automatski pokušati popraviti najviše tri puta.</span>
      </footer>
    </section>
  )
}

function modeLabel(mode: AgentRunMode): string {
  return ({
    guided: 'Vođeno',
    accelerated: 'Ubrzano',
    autonomous: 'Autonomno',
  } as Record<AgentRunMode, string>)[mode]
}

function sourcePolicyLabel(policy: AgentSourcePolicy): string {
  return ({
    uploaded_only: 'Samo tvoji materijali',
    uploaded_plus_suggestions: 'Tvoji materijali + prijedlozi',
    web_research: 'Šira provjera izvora',
  } as Record<AgentSourcePolicy, string>)[policy]
}
