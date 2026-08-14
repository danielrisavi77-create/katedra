import { describe, expect, it } from 'vitest'

import { parseAgentRunRequest } from './run-request'

describe('agent run request', () => {
  it('accepts only supported mode and source policy combinations', () => {
    expect(parseAgentRunRequest({ mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro', 'analysis'] })).toEqual({
      ok: true,
      value: { mode: 'autonomous', sourcePolicy: 'web_research', sectionIds: ['intro', 'analysis'] },
    })
  })

  it('preserves the local manuscript snapshot for server-side run preparation', () => {
    const manuscript = { projectId: 'project-1', schemaVersion: 1 }
    expect(parseAgentRunRequest({ mode: 'guided', sourcePolicy: 'uploaded_only', sectionIds: [], manuscript })).toMatchObject({
      ok: true,
      value: { manuscript },
    })
  })

  it('preserves and bounds temporary material ids', () => {
    expect(parseAgentRunRequest({ mode: 'guided', sourcePolicy: 'uploaded_only', sectionIds: [], materialIds: ['material-1'] })).toMatchObject({
      ok: true,
      value: { materialIds: ['material-1'] },
    })
    expect(parseAgentRunRequest({ mode: 'guided', sourcePolicy: 'uploaded_only', sectionIds: [], materialIds: new Array(101).fill('material') })).toMatchObject({ ok: false, status: 400 })
  })

  it('rejects unsupported values and missing fields', () => {
    expect(parseAgentRunRequest({ mode: 'magic', sourcePolicy: 'web_research' })).toMatchObject({ ok: false, status: 400 })
    expect(parseAgentRunRequest({ mode: 'guided' })).toMatchObject({ ok: false, status: 400 })
    expect(parseAgentRunRequest({ mode: 'guided', sourcePolicy: 'uploaded_only', sectionIds: [''] })).toMatchObject({ ok: false, status: 400 })
  })
})
