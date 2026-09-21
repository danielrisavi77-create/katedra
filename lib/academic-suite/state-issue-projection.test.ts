import { expect, it } from 'vitest'
import { sanitizeLektaIssues } from './state-issue-projection'

it('projects only bounded structured findings without document text', () => {
  expect(sanitizeLektaIssues([{
    id: ' finding-1 ', ruleId: 'rule-1', label: 'Short label', severity: 'warning',
    status: 'RECHECK_REQUIRED', fixable: true, paragraph: 'private manuscript',
    detail: 'private source passage', nested: { text: 'private' },
  }])).toEqual([{ id: 'finding-1', ruleId: 'rule-1', label: 'Short label', severity: 'warning', status: 'RECHECK_REQUIRED', fixable: true }])
})

it('bounds the existing projection and discards malformed fields', () => {
  const input = Array.from({ length: 260 }, (_, i) => ({ id: `id-${i}`, label: 'x'.repeat(281), status: 'invented', severity: 'invented', fixable: 'yes' }))
  const output = sanitizeLektaIssues(input)
  expect(output).toHaveLength(250)
  expect(output[0]).toEqual({ id: 'id-0' })
})

it('ignores non-object findings and findings without bounded IDs', () => {
  expect(sanitizeLektaIssues([null, [], 'text', { id: '' }, { id: 'x'.repeat(201) }])).toEqual([])
  expect(sanitizeLektaIssues({ id: 'not-an-array' })).toEqual([])
})
