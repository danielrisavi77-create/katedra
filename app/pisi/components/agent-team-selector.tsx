'use client'

export type AgentRunMode = 'guided' | 'accelerated' | 'autonomous'
export type AgentSourcePolicy = 'uploaded_only' | 'uploaded_plus_suggestions' | 'web_research'

export function AgentTeamSelector({
  mode,
  sourcePolicy,
  onModeChange,
  onSourcePolicyChange,
}: {
  mode: AgentRunMode
  sourcePolicy: AgentSourcePolicy
  onModeChange: (mode: AgentRunMode) => void
  onSourcePolicyChange: (policy: AgentSourcePolicy) => void
}) {
  return (
    <div className="pis-agent-selector">
      <div>
        <p className="pis-kicker">Način rada</p>
        <div className="pis-agent-options" role="radiogroup" aria-label="Način rada agenata">
          <Choice checked={mode === 'guided'} onChange={() => onModeChange('guided')} title="Vođeno" detail="Potvrđuješ svaki veći korak." />
          <Choice checked={mode === 'accelerated'} onChange={() => onModeChange('accelerated')} title="Ubrzano" detail="Potvrđuješ plan i završne prijedloge." />
          <Choice checked={mode === 'autonomous'} onChange={() => onModeChange('autonomous')} title="Autonomno" detail="Agenti rade sekvencijalno do Quality Gatea." />
        </div>
      </div>
      <div>
        <p className="pis-kicker">Izvori</p>
        <div className="pis-agent-options" role="radiogroup" aria-label="Pravila izvora">
          <Choice checked={sourcePolicy === 'uploaded_only'} onChange={() => onSourcePolicyChange('uploaded_only')} title="Samo moji materijali" detail="Bez vanjske pretrage." />
          <Choice checked={sourcePolicy === 'uploaded_plus_suggestions'} onChange={() => onSourcePolicyChange('uploaded_plus_suggestions')} title="Moji + prijedlozi" detail="Nove izvore prvo pregledavaš." />
          <Choice checked={sourcePolicy === 'web_research'} onChange={() => onSourcePolicyChange('web_research')} title="Šira pretraga" detail="Provider traži provjerljive izvore." />
        </div>
      </div>
      <p className="pis-agent-disclosure">Katedra automatski odabire odgovarajućeg AI providera. Svaki agent ima zasebnog verifikatora, a neuspjeh se pokušava popraviti najviše tri puta.</p>
    </div>
  )
}

function Choice({ checked, onChange, title, detail }: { checked: boolean; onChange: () => void; title: string; detail: string }) {
  return <label className={`pis-agent-choice${checked ? ' is-selected' : ''}`}><input type="radio" checked={checked} onChange={onChange} /><span><b>{title}</b><small>{detail}</small></span></label>
}
