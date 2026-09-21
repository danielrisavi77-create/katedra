'use client'

export type AgentRunMode = 'guided' | 'accelerated' | 'autonomous'
export type AgentSourcePolicy = 'uploaded_only' | 'uploaded_plus_suggestions' | 'web_research'

export function AgentTeamSelector({
  mode,
  sourcePolicy,
  lockedMode,
  webResearchAvailable = false,
  onModeChange,
  onSourcePolicyChange,
}: {
  mode: AgentRunMode
  sourcePolicy: AgentSourcePolicy
  lockedMode?: 'autonomous'
  webResearchAvailable?: boolean
  onModeChange: (mode: AgentRunMode) => void
  onSourcePolicyChange: (policy: AgentSourcePolicy) => void
}) {
  return (
    <div className="pis-agent-selector">
      {!lockedMode && <div>
        <p className="pis-kicker">Način rada</p>
        <div className="pis-agent-options" role="radiogroup" aria-label="Način rada agenata">
          <Choice checked={mode === 'guided'} onChange={() => onModeChange('guided')} title="Vođeno" detail="Potvrđuješ svaki veći korak." />
          <Choice checked={mode === 'accelerated'} onChange={() => onModeChange('accelerated')} title="Ubrzano" detail="Potvrđuješ plan i završne prijedloge." />
          <Choice checked={mode === 'autonomous'} onChange={() => onModeChange('autonomous')} title="Autonomno" detail="Agenti rade sekvencijalno do Quality Gatea." />
        </div>
      </div>}
      <div>
        <p className="pis-kicker">Izvori</p>
        <div className="pis-agent-options" role="radiogroup" aria-label="Pravila izvora">
          <Choice checked={sourcePolicy === 'uploaded_only'} onChange={() => onSourcePolicyChange('uploaded_only')} title="Samo moji materijali" detail="Bez vanjske pretrage." />
          <Choice checked={sourcePolicy === 'uploaded_plus_suggestions'} onChange={() => onSourcePolicyChange('uploaded_plus_suggestions')} title="Moji + prijedlozi" detail="Nove izvore prvo pregledavaš." />
          <Choice checked={sourcePolicy === 'web_research'} onChange={() => webResearchAvailable && onSourcePolicyChange('web_research')} title={webResearchAvailable ? 'Šira pretraga' : 'Šira pretraga (uskoro)'} detail={webResearchAvailable ? 'Provider traži provjerljive izvore.' : 'Nije dostupno dok ne budu verificirana pravila ustanove i web adapter.'} disabled={!webResearchAvailable} />
        </div>
      </div>
      <p className="pis-agent-disclosure">Katedra automatski odabire odgovarajućeg AI providera. Svaki agent ima zasebnog verifikatora, a neuspjeh se pokušava popraviti najviše tri puta.</p>
    </div>
  )
}

function Choice({ checked, onChange, title, detail, disabled = false }: { checked: boolean; onChange: () => void; title: string; detail: string; disabled?: boolean }) {
  return <label className={`pis-agent-choice${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}><input type="radio" checked={checked} onChange={onChange} disabled={disabled} /><span><b>{title}</b><small>{detail}</small></span></label>
}
