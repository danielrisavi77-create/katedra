import { describe, expect, it } from 'vitest'

import pack from '../../public/katedra-process-facts.json'
import {
  AI_CAPABILITY_LABELS,
  AI_CAPABILITY_STANCE_BADGE,
  explainCapability,
  resolveCapability,
  type AiCapabilityId,
  type ProcessFactPack,
} from './process-facts'

const CAPABILITIES = Object.keys(AI_CAPABILITY_LABELS) as AiCapabilityId[]

describe('verified AI policy pilots', () => {
  it('contains exactly the two deeply sourced pilot faculties', () => {
    const pilotPack = pack as ProcessFactPack
    expect(pilotPack.schemaVersion).toBe('0.1')
    expect(pilotPack.entries.map((entry) => entry.unitId).sort()).toEqual(['foi', 'fpzg'])
    expect(pilotPack.entries.every((entry) => entry.status === 'verified')).toBe(true)
    expect(pilotPack.entries.every((entry) => entry.source?.u.startsWith('https://'))).toBe(true)
    expect(pilotPack.entries.every((entry) => entry.verifiedDate === '2026-08-22')).toBe(true)
  })

  it.each(['fpzg', 'foi'])('%s has a separately recorded answer for every AI action', (unitId) => {
    const entry = (pack as ProcessFactPack).entries.find((item) => item.unitId === unitId)
    expect(entry).toBeDefined()
    expect(Object.keys(entry?.aiCapabilities || {}).sort()).toEqual(CAPABILITIES.sort())
    expect(entry?.aiCapabilities).toBeTruthy()
    expect(entry?.requirements).toMatchObject({
      aiDisclosure: { required: true },
      mentorApproval: { required: true },
    })
  })

  it('preserves the FPZG source-grounded boundaries', () => {
    const pilotPack = pack as ProcessFactPack

    expect(resolveCapability(pilotPack, 'fpzg', 'research_discovery')).toMatchObject({ stance: 'allowed', effective: 'allowed' })
    expect(resolveCapability(pilotPack, 'fpzg', 'language_editing')).toMatchObject({ stance: 'allowed', effective: 'allowed' })
    expect(resolveCapability(pilotPack, 'fpzg', 'translation')).toMatchObject({ stance: 'allowed', effective: 'allowed' })
    expect(resolveCapability(pilotPack, 'fpzg', 'generate_submission_text')).toMatchObject({ stance: 'banned', effective: 'blocked' })
    expect(resolveCapability(pilotPack, 'fpzg', 'generate_large_sections')).toMatchObject({ stance: 'banned', effective: 'blocked' })
  })

  it('requires the FOI mentor and documentation path for higher-risk work', () => {
    const resolved = resolveCapability(pack as ProcessFactPack, 'foi', 'generate_large_sections')

    expect(resolved).toMatchObject({
      stance: 'conditional',
      effective: 'blocked',
      condition: { mentorApproval: true, disclosureRequired: true },
    })
  })

  it('records when a source has no separately stated effective date', () => {
    const entry = (pack as ProcessFactPack).entries.find((item) => item.unitId === 'foi')

    expect(entry).toMatchObject({
      effectiveDateStatus: 'not-stated',
      effectiveDateNote: expect.stringContaining('nije naveden'),
    })
  })

  it('explains the decision and exposes the source behind it', () => {
    const explanation = explainCapability(pack as ProcessFactPack, 'fpzg', 'generate_submission_text')

    expect(explanation).toMatchObject({
      capability: 'generate_submission_text',
      label: AI_CAPABILITY_LABELS.generate_submission_text,
      effective: 'blocked',
      source: { u: expect.stringContaining('fpzg.unizg.hr') },
      sourceFactId: expect.any(String),
      verifiedDate: '2026-08-22',
    })
    expect(explanation.reason).toContain('zabranjuje')
    expect(explanation.source?.t).toBeTruthy()
  })

  it('explains the safe default when no faculty policy is available', () => {
    const explanation = explainCapability(null, 'unknown', 'generate_large_sections')

    expect(explanation).toMatchObject({ effective: 'blocked', stance: 'unspecified', source: undefined })
    expect(explanation.reason).toContain('nema verificiranog')
  })

  it('keeps the policy status icon contract intact', () => {
    expect(AI_CAPABILITY_STANCE_BADGE).toMatchObject({ allowed: '🟢', conditional: '🟡', banned: '🔴', unspecified: '⚪' })
  })
})
