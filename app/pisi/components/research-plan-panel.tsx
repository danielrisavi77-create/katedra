'use client'

import type { ResearchPlanFieldV1, ResearchPlanStatus, ResearchPlanV1 } from '../../../lib/research-plan/types'
import { isReadyForReview } from '../../../lib/research-plan/validation'

type ResearchPlanSnapshotSummary = { id: string; reason: string; createdAt: string }

export function ResearchPlanPanel({
  plan,
  onChange,
  onTransition,
  onSnapshot,
  snapshots = [],
  onRestore,
  storageStatus = 'saved',
}: {
  plan: ResearchPlanV1
  onChange: (plan: ResearchPlanV1) => void
  onTransition: (status: ResearchPlanStatus) => void
  onSnapshot?: (reason: string) => void
  snapshots?: ResearchPlanSnapshotSummary[]
  onRestore?: (snapshotId: string) => void
  storageStatus?: 'saving' | 'saved' | 'error'
}) {
  const reviewReady = isReadyForReview(plan)
  const readOnly = plan.status === 'approved'
  const updateDesign = (field: keyof ResearchPlanV1['design'], value: string) => onChange({ ...plan, design: { ...plan.design, [field]: value }, status: readOnly ? 'draft' : plan.status })
  const updateMethodology = (field: keyof ResearchPlanV1['methodology'], value: string) => onChange({ ...plan, methodology: { ...plan.methodology, [field]: value }, status: readOnly ? 'draft' : plan.status })
  const updateRepeated = (field: 'hypotheses' | 'variables' | 'cases', id: string, value: string) => onChange({ ...plan, design: { ...plan.design, [field]: plan.design[field].map((entry) => entry.id === id ? { ...entry, value, updatedAt: new Date().toISOString() } : entry) }, status: readOnly ? 'draft' : plan.status })
  const addRepeated = (field: 'hypotheses' | 'variables' | 'cases') => onChange({ ...plan, design: { ...plan.design, [field]: [...plan.design[field], newField()] }, status: readOnly ? 'draft' : plan.status })
  const removeRepeated = (field: 'hypotheses' | 'variables' | 'cases', id: string) => onChange({ ...plan, design: { ...plan.design, [field]: plan.design[field].filter((entry) => entry.id !== id) }, status: readOnly ? 'draft' : plan.status })

  return (
    <section className="pis-research-plan" aria-labelledby="research-plan-heading">
      <div className="pis-research-plan-header">
        <p className="pis-kicker">Istraživanje prije pisanja</p>
        <h3 id="research-plan-heading">Istraživački plan</h3>
        <p className="pis-research-plan-intro">Ovdje se istraživačka ideja pretvara u provjerljiv plan. Katedra može pomoći, ali ne prihvaća plan umjesto tebe.</p>
        <div className="pis-research-plan-meta">
          <span data-status={plan.status}>{statusLabel(plan.status)}</span>
          <span>{storageLabel(storageStatus)}</span>
        </div>
      </div>

      <p className="pis-boundary-note">Sprema se samo na ovom uređaju. Svaka potvrda stvara novu lokalnu reviziju; rukopis se ne šalje u ovaj modul.</p>

      <div className="pis-research-plan-section">
        <div className="pis-research-plan-section-heading"><span>01</span><div><b>Research Design Canvas</b><small>Što istražuješ i zašto je to važno?</small></div></div>
        <Field label="Problem" value={plan.design.problem} onChange={(value) => updateDesign('problem', value)} readOnly={readOnly} multiline />
        <Field label="Cilj istraživanja" value={plan.design.goal} onChange={(value) => updateDesign('goal', value)} readOnly={readOnly} multiline />
        <Field label="Istraživačko pitanje" value={plan.design.researchQuestion} onChange={(value) => updateDesign('researchQuestion', value)} readOnly={readOnly} multiline />
        <RepeatedFields label="Hipoteze" entries={plan.design.hypotheses} onAdd={() => addRepeated('hypotheses')} onChange={(id, value) => updateRepeated('hypotheses', id, value)} onRemove={(id) => removeRepeated('hypotheses', id)} readOnly={readOnly} addLabel="Dodaj hipotezu" />
        <RepeatedFields label="Varijable" entries={plan.design.variables} onAdd={() => addRepeated('variables')} onChange={(id, value) => updateRepeated('variables', id, value)} onRemove={(id) => removeRepeated('variables', id)} readOnly={readOnly} addLabel="Dodaj varijablu" />
        <RepeatedFields label="Slučajevi / uzorak" entries={plan.design.cases} onAdd={() => addRepeated('cases')} onChange={(id, value) => updateRepeated('cases', id, value)} onRemove={(id) => removeRepeated('cases', id)} readOnly={readOnly} addLabel="Dodaj slučaj" />
        <Field label="Očekivani doprinos" value={plan.design.expectedContribution} onChange={(value) => updateDesign('expectedContribution', value)} readOnly={readOnly} multiline />
      </div>

      <div className="pis-research-plan-section">
        <div className="pis-research-plan-section-heading"><span>02</span><div><b>Methodology Builder</b><small>Kako ćeš doći do odgovora?</small></div></div>
        <Field label="Dizajn istraživanja" value={plan.methodology.design} onChange={(value) => updateMethodology('design', value)} readOnly={readOnly} multiline />
        <Field label="Uzorak" value={plan.methodology.sample} onChange={(value) => updateMethodology('sample', value)} readOnly={readOnly} multiline />
        <Field label="Operacionalizacija" value={plan.methodology.operationalization} onChange={(value) => updateMethodology('operationalization', value)} readOnly={readOnly} multiline />
        <Field label="Instrument" value={plan.methodology.instrument} onChange={(value) => updateMethodology('instrument', value)} readOnly={readOnly} multiline />
        <Field label="Analiza" value={plan.methodology.analysis} onChange={(value) => updateMethodology('analysis', value)} readOnly={readOnly} multiline />
        <Field label="Ograničenja" value={plan.methodology.limitations} onChange={(value) => updateMethodology('limitations', value)} readOnly={readOnly} multiline />
        <Field label="Etika" value={plan.methodology.ethics} onChange={(value) => updateMethodology('ethics', value)} readOnly={readOnly} multiline />
      </div>

      <div className="pis-research-plan-actions">
        {plan.status === 'empty' && <button type="button" className="pis-secondary-button" onClick={() => onTransition('draft')}>Započni plan</button>}
        {plan.status === 'draft' && <button type="button" className="pis-primary-button" disabled={!reviewReady} onClick={() => onTransition('review')}>Pošalji na pregled</button>}
        {plan.status === 'review' && <><button type="button" className="pis-secondary-button" onClick={() => onTransition('draft')}>Nastavi uređivati</button><button type="button" className="pis-primary-button" disabled={!reviewReady} onClick={() => onTransition('approved')}>Odobri plan</button></>}
        {plan.status === 'approved' && <button type="button" className="pis-secondary-button" onClick={() => { onSnapshot?.('Prije uređivanja odobrenog plana'); onTransition('draft') }}>Uredi odobreni plan</button>}
        {onSnapshot && plan.status !== 'empty' && <button type="button" className="pis-text-button" onClick={() => onSnapshot('Ručna revizija plana')}>Spremi reviziju</button>}
      </div>

      {snapshots.length > 0 && <div className="pis-research-plan-history"><b>Lokalne revizije plana</b>{snapshots.slice(0, 5).map((snapshot) => <div key={snapshot.id}><span>{snapshot.reason}<small>{formatDate(snapshot.createdAt)}</small></span><button type="button" onClick={() => onRestore?.(snapshot.id)}>Vrati</button></div>)}</div>}
    </section>
  )
}

function Field({ label, value, onChange, readOnly, multiline = false }: { label: string; value: string; onChange: (value: string) => void; readOnly: boolean; multiline?: boolean }) {
  const common = { id: label, value, readOnly, onChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => onChange(event.target.value), 'aria-label': label }
  return <label className="pis-research-field">{label}{multiline ? <textarea {...common} rows={3} /> : <input {...common} />}</label>
}

function RepeatedFields({ label, entries, onAdd, onChange, onRemove, readOnly, addLabel }: { label: string; entries: ResearchPlanFieldV1[]; onAdd: () => void; onChange: (id: string, value: string) => void; onRemove: (id: string) => void; readOnly: boolean; addLabel: string }) {
  return <div className="pis-research-repeated"><div className="pis-research-field-label">{label}</div>{entries.map((entry, index) => <div className="pis-research-repeated-row" key={entry.id}><span>{index + 1}</span><input aria-label={`${label} ${index + 1}`} value={entry.value} readOnly={readOnly} onChange={(event) => onChange(entry.id, event.target.value)} /><button type="button" aria-label={`Ukloni ${label.toLowerCase()} ${index + 1}`} onClick={() => onRemove(entry.id)} disabled={readOnly}>×</button></div>)}<button type="button" className="pis-text-button pis-research-add" onClick={onAdd} disabled={readOnly}>+ {addLabel}</button></div>
}

function newField(): ResearchPlanFieldV1 {
  return { id: `field-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`, value: '', updatedAt: new Date().toISOString() }
}

function statusLabel(status: ResearchPlanStatus): string {
  return ({ empty: 'Nije započeto', draft: 'Radna verzija', review: 'Spremno za pregled', approved: 'Odobreno' } as Record<ResearchPlanStatus, string>)[status]
}

function storageLabel(status: 'saving' | 'saved' | 'error'): string {
  return ({ saving: 'Spremanje…', saved: 'Spremljeno lokalno', error: 'Spremanje nije uspjelo' } as const)[status]
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
