import { describe, expect, it } from 'vitest'

import { buildRunStudioEvents, currentRunStudioStatus } from './run-studio'

describe('Run Studio event projection', () => {
  it('does not invent process events before a run checkpoint exists', () => {
    expect(buildRunStudioEvents({})).toEqual([])
  })

  it('explains the active agent, verifier and next pending step', () => {
    const result = buildRunStudioEvents({
      run: { status: 'running', mode: 'autonomous' },
      sections: [{ id: 'intro', title: 'Uvod' }],
      steps: [
        { step_id: 'step-1', agent: 'intake', verifier: 'intake_verifier', status: 'verified', attempt: 1 },
        { step_id: 'step-2', agent: 'writing', verifier: 'writing_verifier', section_id: 'intro', status: 'running', attempt: 2 },
        { step_id: 'step-3', agent: 'citation', verifier: 'citation_verifier', status: 'pending', attempt: 1 },
      ],
      results: [],
    })

    expect(eventsByKind(result, 'step_active')[0]).toMatchObject({
      actor: 'katedra',
      title: 'Katedra piše poglavlje Uvod',
      attempt: 2,
      sectionId: 'intro',
    })
    expect(eventsByKind(result, 'verifier_active')[0]).toMatchObject({
      actor: 'verifier',
      title: 'Verifikator pisanja čeka rezultat',
    })
    expect(eventsByKind(result, 'step_waiting')[0]).toMatchObject({
      title: 'Sljedeće: Provjera izvora',
    })
    expect(currentRunStudioStatus(result)).toMatchObject({
      label: 'Katedra piše poglavlje Uvod',
      state: 'active',
      nextAction: 'Nakon pisanja slijedi provjera rezultata.',
    })
  })

  it('shows verified output, evidence and a blocked verification issue', () => {
    const result = buildRunStudioEvents({
      run: { status: 'blocked', mode: 'guided' },
      steps: [
        { step_id: 'step-1', agent: 'sources', verifier: 'sources_verifier', status: 'blocked', attempt: 3, last_verification: { issues: [{ message: 'Nedostaje DOI ili provjerljiva poveznica.' }] } },
      ],
      results: [{
        stepId: 'step-1',
        sectionId: 'analysis',
        createdAt: '2026-08-15T12:00:00.000Z',
        output: 'Predloženi izvori.',
        citations: [{ id: 'source-1', title: 'Provjereni izvor', url: 'https://example.test/source', verified: true }],
        verification: { status: 'blocked', issues: [{ message: 'Nedostaje DOI ili provjerljiva poveznica.' }] },
      }],
    })

    expect(eventsByKind(result, 'result_ready')[0]).toMatchObject({
      title: 'Rezultat čeka tvoju odluku',
      sectionId: 'analysis',
      sources: [{ title: 'Provjereni izvor', verified: true }],
    })
    expect(eventsByKind(result, 'step_blocked')[0]).toMatchObject({
      actor: 'verifier',
      status: 'blocked',
      attempt: 3,
      details: ['Nedostaje DOI ili provjerljiva poveznica.'],
    })
    expect(eventsByKind(result, 'source_verified')[0]).toMatchObject({
      title: 'Identitet izvora provjeren: Provjereni izvor',
      summary: 'Bibliografski identitet izvora je neovisno provjeren.',
    })
    expect(currentRunStudioStatus(result)).toMatchObject({
      state: 'blocked',
      nextAction: 'Dodaj traženi kontekst pa pokušaj ponovno.',
    })
  })

  it('drops unsafe source URLs from the event projection', () => {
    const result = buildRunStudioEvents({
      run: { status: 'completed', mode: 'guided' },
      results: [{
        stepId: 'step-1',
        output: 'Rezultat',
        citations: [{ id: 'source-1', title: 'Nepouzdan izvor', url: 'javascript:alert(1)', verified: true }],
        verification: { status: 'verified', issues: [], evidence: [] },
      }],
    })

    expect(eventsByKind(result, 'result_ready')[0].sources).toEqual([{
      id: 'source-1',
      title: 'Nepouzdan izvor',
      verified: true,
    }])
  })

  it('marks a completed run as finished when all steps are verified', () => {
    const events = buildRunStudioEvents({
      run: { status: 'completed', mode: 'guided' },
      steps: [{ step_id: 'step-1', agent: 'review', verifier: 'review_verifier', status: 'verified', attempt: 1 }],
      results: [],
    })

    expect(currentRunStudioStatus(events)).toMatchObject({ state: 'complete', label: 'Tijek je završen' })
  })

  it('describes a verified step as structural review, not semantic truth', () => {
    const events = buildRunStudioEvents({
      run: { status: 'completed', mode: 'guided' },
      steps: [{ step_id: 'step-1', agent: 'review', verifier: 'review_verifier', status: 'verified', attempt: 1 }],
      results: [],
    })

    expect(eventsByKind(events, 'step_verified')[0]).toMatchObject({
      title: 'Provjera je završila korak',
      summary: 'Rezultat ima provjereni trag strukture i izvora; pregledaj sadržaj prije prihvaćanja.',
    })
  })
  it('keeps a paused run visibly paused even when it has no active step', () => {
    const events = buildRunStudioEvents({
      run: { status: 'paused', mode: 'guided' },
      steps: [{ step_id: 'step-1', agent: 'writing', verifier: 'writing_verifier', status: 'pending', attempt: 1 }],
      results: [],
    })

    expect(currentRunStudioStatus(events)).toMatchObject({
      state: 'paused',
      label: 'Tijek je pauziran',
      nextAction: 'Nastavi tijek kada budeš spreman.',
    })
  })
})

function eventsByKind(events: ReturnType<typeof buildRunStudioEvents>, kind: string) {
  return events.filter((event) => event.kind === kind)
}
