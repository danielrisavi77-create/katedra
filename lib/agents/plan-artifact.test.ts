import { describe, expect, it } from 'vitest'

import type { VerifiedAgentArtifactContext } from './artifact-chain'
import { extractPlanArtifact, planLooksApprovable } from './plan-artifact'

function artifact(agent: 'structure' | 'planning', output: string, stepOrder = 1): VerifiedAgentArtifactContext {
  return { artifactId: `a-${agent}`, stepId: `s-${agent}`, agent, verifier: `${agent}_verifier`, stepOrder, attempt: 1, output, citations: [] }
}

const STRUCTURE = `Teza: Obvezno glasanje povećava formalnu, ali ne i percipiranu legitimnost.
<!-- PLAN:JSON -->
{"thesis":"Obvezno glasanje povećava formalnu, ali ne i percipiranu legitimnost.","question":"Kako obvezno glasanje utječe na legitimnost?","perspectives":[{"label":"Institucionalna","position":"odaziv jest legitimnost","why":"Lijphart"},{"label":"Bihevioralna","position":"prisila ne mijenja stav","why":"Birch"}],"chapters":[{"sectionId":"s1","title":"Uvod","pages":2},{"sectionId":"s2","title":"Teorijski okvir","pages":6}]}
<!-- /PLAN:JSON -->`

const PLANNING = `<!-- PLAN:JSON -->
{"chapters":[{"sectionId":"s1","content":"kontekst, pitanje, teza, metoda","sources":["src-1"]},{"sectionId":"s2","content":"pojmovi legitimnosti","sources":["src-1","src-2"]}]}
<!-- /PLAN:JSON -->`

describe('plan-artifact', () => {
  it('spaja structure i planning po sectionId', () => {
    const plan = extractPlanArtifact([artifact('structure', STRUCTURE, 3), artifact('planning', PLANNING, 4)])
    expect(plan?.thesis).toContain('formalnu')
    expect(plan?.perspectives).toHaveLength(2)
    expect(plan?.chapters).toHaveLength(2)
    expect(plan?.chapters[1]).toMatchObject({ sectionId: 's2', pages: 6, content: 'pojmovi legitimnosti', sources: ['src-1', 'src-2'] })
    expect(planLooksApprovable(plan, 'd')).toBe(true)
  })

  it('bez planning koraka plan nije odobriv (nema sadržaja ni izvora)', () => {
    const plan = extractPlanArtifact([artifact('structure', STRUCTURE)])
    expect(plan?.chapters).toHaveLength(2)
    expect(planLooksApprovable(plan, 'd')).toBe(false)
  })

  it('rezerva: tablica STRUKTURA i redak Teza', () => {
    const out = `Teza: X se dade osporiti.\n<!-- STRUKTURA:POCETAK -->\n| Pogl. | Naslov | Str. | Sadržaj | Izvori |\n|---|---|---|---|---|\n| 1. | Uvod | 2 | kontekst i teza | src-1 |\n<!-- STRUKTURA:KRAJ -->`
    const plan = extractPlanArtifact([artifact('structure', out)])
    expect(plan?.thesis).toBe('X se dade osporiti.')
    expect(plan?.chapters[0]).toMatchObject({ title: 'Uvod', pages: 2, content: 'kontekst i teza', sources: ['src-1'] })
    expect(planLooksApprovable(plan, 's')).toBe(true)
    expect(planLooksApprovable(plan, 'z')).toBe(false)
  })

  it('ignorira agente izvan structure/planning i vraća null bez sadržaja', () => {
    expect(extractPlanArtifact([])).toBeNull()
  })
})


it('merges legacy titles and JSON chapter programs using a unique existing section', () => {
  const structure = artifact('structure', 'Teza: Thesis.\n<!-- STRUKTURA:POCETAK -->\n| 1. | Uvod | 2 | Initial program | src-1 |\n<!-- STRUKTURA:KRAJ -->', 2)
  const planning = artifact('planning', '<!-- PLAN:JSON -->{"chapters":[{"sectionId":"s1","content":"Updated program","sources":["src-2"]}]}<!-- /PLAN:JSON -->', 3)
  const plan = extractPlanArtifact([planning, structure], [{ id: 's1', title: ' Uvod ', kind: 'chapter' }])
  expect(plan?.chapters).toEqual([{ sectionId: 's1', title: 'Uvod', pages: 2, content: 'Updated program', sources: ['src-2'] }])
})

it('does not invent section identity for ambiguous or missing legacy titles', () => {
  const structure = artifact('structure', '<!-- PLAN:JSON -->{"chapters":[{"title":"Repeated"},{"title":"Missing"}]}<!-- /PLAN:JSON -->')
  const plan = extractPlanArtifact([structure], [{ id: 'a', title: 'Repeated', kind: 'chapter' }, { id: 'b', title: 'Repeated', kind: 'chapter' }])
  expect(plan?.chapters.map((chapter) => chapter.sectionId)).toEqual([undefined, undefined])
})
