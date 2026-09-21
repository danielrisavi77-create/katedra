import { expect, it } from 'vitest'
import { compareDatabaseProjection } from './check-database-projection.mjs'

function schema(row = 'id: string; project_id: string | null', insert = 'id?: string') {
  return `export type Database = { __InternalSupabase: { PostgrestVersion: '14.5' }; public: { Tables: { entitlements: { Row: { ${row} }; Insert: { ${insert} }; Update: { id?: string }; Relationships: [] }; unrelated: { Row: { private: string } } } } }`
}

it('compares only the consumed projection independent of formatting and key order', () => {
  expect(compareDatabaseProjection(schema(), schema('project_id: null | string; id: string'))).toEqual([])
})

it.each([
  ['nullability', schema('id: string; project_id: string')],
  ['optionality', schema(undefined, 'id: string')],
  ['column addition', schema('id: string; project_id: string | null; added: boolean')],
  ['column removal', schema('id: string')],
  ['PostgREST version', schema().replace("'14.5'", "'15.0'")],
])('detects canonical drift: %s', (_label, canonical) => {
  expect(compareDatabaseProjection(canonical, schema()).length).toBeGreaterThan(0)
})

it.each([
  'export type Database = {',
  schema().replace('entitlements:', 'missing_table:'),
  schema('id: Json'),
  schema('id: string; id: number'),
])('refuses incomplete or unsupported canonical types', (source) => {
  expect(() => compareDatabaseProjection(source, schema())).toThrow()
})
