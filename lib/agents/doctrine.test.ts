import { describe, expect, it } from 'vitest'

import { AGENT_IDS } from './contracts'
import { DOCTRINE_BY_AGENT, DOCTRINE_COMMON, MARKERS, buildAgentSystemPrompt } from './doctrine'

const FORBIDDEN_DASHES = /[\u2013\u2014]/

describe('doctrine: granica proizvoda', () => {
  it('svaki agent dobiva granicu prema Lekti i pravilo da se ništa ne izmišlja', () => {
    for (const agent of AGENT_IDS) {
      const prompt = buildAgentSystemPrompt(agent, { workType: 'd' })
      expect(prompt).toContain('Lekta je jedini autoritet')
      expect(prompt).toContain('Ništa se ne izmišlja')
      expect(prompt).toContain(MARKERS.needsSource)
    }
  })

  it('nijedan agent ne obećava tehničku provjeru dokumenta', () => {
    for (const agent of AGENT_IDS) {
      const text = DOCTRINE_BY_AGENT[agent].toLowerCase()
      expect(text).not.toMatch(/provjerio sam margine|provjeri margine|font je ispravan|compliance score/)
    }
  })

  it('doktrina nema dugih crtica (kućni stil vlasnika)', () => {
    expect(DOCTRINE_COMMON).not.toMatch(FORBIDDEN_DASHES)
    for (const agent of AGENT_IDS) expect(DOCTRINE_BY_AGENT[agent]).not.toMatch(FORBIDDEN_DASHES)
  })
})

describe('doctrine: razina i profil', () => {
  it('tip rada bira zadanu razinu', () => {
    expect(buildAgentSystemPrompt('writing', { workType: 's' })).toContain('RAZINA preddiplomski 1. do 2. godina')
    expect(buildAgentSystemPrompt('writing', { workType: 'z' })).toContain('RAZINA završni rad')
    expect(buildAgentSystemPrompt('writing', { workType: 'd' })).toContain('RAZINA diplomski')
  })

  it('bez profila traži provjeru u službenim uputama umjesto pogađanja', () => {
    const prompt = buildAgentSystemPrompt('planning', { workType: 'z' })
    expect(prompt).toContain('PROFIL FAKULTETA: nije zadan')
    expect(prompt).toContain('provjeri u službenim uputama')
  })

  it('poznat citatni dijalekt iz packa prevodi se u konkretan oblik', () => {
    const prompt = buildAgentSystemPrompt('writing', { workType: 'd', profile: { citation: 'fpzg', label: 'FPZG · diplomski' } })
    expect(prompt).toContain('(Lindblom, 1959: 81)')
    expect(prompt).toContain('informativno')
  })

  it('nepoznat dijalekt ne pogađa oblik', () => {
    const prompt = buildAgentSystemPrompt('writing', { workType: 'd', profile: { citation: 'nesto-novo' } })
    expect(prompt).toContain('ne pogađaj')
  })

  it('partial profil traži oznaku "za potvrdu"', () => {
    const prompt = buildAgentSystemPrompt('structure', { workType: 'z', profile: { status: 'partial', sections: ['sažetak', 'literatura'] } })
    expect(prompt).toContain('status "partial"')
    expect(prompt).toContain('sažetak, literatura')
  })
})

describe('doctrine: politika i način rada', () => {
  it('policyBlocked mijenja samo writing i export', () => {
    const blocked = buildAgentSystemPrompt('writing', { workType: 'd', policyBlocked: true })
    expect(blocked).toContain('INSTITUCIJSKA AI POLITIKA')
    const review = buildAgentSystemPrompt('review', { workType: 'd', policyBlocked: true })
    expect(review).not.toContain('INSTITUCIJSKA AI POLITIKA')
  })

  it('autonomous ne preskače odobrenje plana', () => {
    const prompt = buildAgentSystemPrompt('planning', { workType: 'd', runMode: 'autonomous' })
    expect(prompt).toContain('ne preskače odobrenje plana')
  })

  it('gatePhase najavljuje deterministički gate', () => {
    const prompt = buildAgentSystemPrompt('writing', { workType: 'd', gatePhase: 'pisanje' })
    expect(prompt).toContain('gate faze "pisanje"')
  })
})

describe('doctrine: veličina', () => {
  it('system prompt ostaje ispod 20k znakova po agentu', () => {
    for (const agent of AGENT_IDS) {
      const prompt = buildAgentSystemPrompt(agent, { workType: 'd', profile: { citation: 'fpzg', status: 'verified' }, runMode: 'guided', gatePhase: 'audit' })
      expect(prompt.length).toBeLessThan(20_000)
    }
  })
})
