// Server-only loader for the same process-facts pack the client fetches over
// HTTP (process-facts.ts's loadProcessFacts()). API routes need this data to
// resolve AI-capability policy server-side (Audit 5 — server must be the
// enforcement authority, not just the client), and a relative fetch() isn't
// meaningful from a route handler, so this reads the identical seed file
// straight off disk instead of duplicating it. One file, one source of truth.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ProcessFactPack } from './process-facts'

let cache: ProcessFactPack | null = null
let pending: Promise<ProcessFactPack | null> | null = null

export async function loadProcessFactsFromDisk(): Promise<ProcessFactPack | null> {
  if (cache) return cache
  if (!pending) {
    pending = readFile(path.join(process.cwd(), 'public', 'katedra-process-facts.json'), 'utf8')
      .then((raw) => JSON.parse(raw) as ProcessFactPack)
      .catch(() => null)
  }
  cache = await pending
  return cache
}
