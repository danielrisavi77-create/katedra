// @ts-check
// Offline only: canonical generated types remain owned and produced by Lekta.
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** @param {ts.TypeNode} node @returns {Map<string, ts.PropertySignature>} */
function members(node) {
  if (!ts.isTypeLiteralNode(node)) throw new Error('Expected a generated object type')
  const result = new Map()
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.type
      || !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) throw new Error('Unsupported generated property')
    const name = member.name.text
    if (result.has(name)) throw new Error('Duplicate generated property')
    result.set(name, member)
  }
  return result
}

/** @param {ts.TypeNode} node @param {string[]} path @returns {ts.TypeNode} */
function at(node, path) {
  for (const name of path) {
    const next = members(node).get(name)
    if (!next?.type || next.questionToken) throw new Error(`Missing required projection member: ${name}`)
    node = next.type
  }
  return node
}

/** @param {ts.TypeNode} node @returns {string} */
function shape(node) {
  if (ts.isParenthesizedTypeNode(node)) return shape(node.type)
  if (ts.isUnionTypeNode(node)) return JSON.stringify(['union', [...new Set(node.types.map(shape))].sort()])
  if (ts.isTypeLiteralNode(node)) {
    return JSON.stringify([...members(node)].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, field]) => [name, !!field.questionToken, shape(/** @type {ts.TypeNode} */ (field.type))]))
  }
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) return JSON.stringify(['literal', node.literal.text])
    if (node.literal.kind === ts.SyntaxKind.NullKeyword) return 'null'
  }
  const keyword = new Map([
    [ts.SyntaxKind.StringKeyword, 'string'], [ts.SyntaxKind.NumberKeyword, 'number'],
    [ts.SyntaxKind.BooleanKeyword, 'boolean'],
  ]).get(node.kind)
  if (keyword) return keyword
  // A newly consumed Json/enum/reference needs an explicit coordinated
  // projection change; do not erase it to any or pretend it matches.
  throw new Error('Unsupported consumed type; refresh the projection contract explicitly')
}

/** @param {string} source @returns {ts.TypeNode} */
function database(source) {
  const parsed = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext } })
  if (parsed.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error('Malformed generated TypeScript')
  const file = ts.createSourceFile('database.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const aliases = file.statements.filter(ts.isTypeAliasDeclaration).filter(node => node.name.text === 'Database')
  if (aliases.length !== 1) throw new Error('Expected exactly one Database type')
  return aliases[0].type
}

/** @param {string} canonicalSource @param {string} checkedInSource @returns {string[]} */
export function compareDatabaseProjection(canonicalSource, checkedInSource) {
  const canonical = database(canonicalSource)
  const checkedIn = database(checkedInSource)
  const paths = [
    ['__InternalSupabase'],
    ...['Row', 'Insert', 'Update'].map(kind => ['public', 'Tables', 'entitlements', kind]),
  ]
  return paths.filter(path => shape(at(canonical, path)) !== shape(at(checkedIn, path))).map(path => path.join('.'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 2 || args[0] !== '--source') throw new Error('Usage: node scripts/check-database-projection.mjs --source <Lekta-generated-types.ts>')
    if (statSync(args[1]).size > 10 * 1024 * 1024) throw new Error('Canonical type source exceeds 10 MiB')
    const drift = compareDatabaseProjection(readFileSync(args[1], 'utf8'), readFileSync(new URL('../lib/academic-suite/database.types.ts', import.meta.url), 'utf8'))
    if (drift.length) {
      console.error(`DATABASE_PROJECTION_DRIFT: ${drift.join(', ')}`)
      process.exitCode = 1
    } else console.log('DATABASE_PROJECTION_MATCH: supplied source only; deployment identity is not verified')
  } catch (error) {
    console.error(`DATABASE_PROJECTION_NOT_VERIFIED: ${error instanceof Error ? error.message : 'invalid source'}`)
    process.exitCode = 1
  }
}
