// lib/agents/pack-profile.server.ts
// Server-only čitanje Lektine projekcije pravila (public/katedra-pack.json) za doktrinu.
// Informativno po ustavu §3: Katedra iz ovoga ne izvodi tvrdnju o usklađenosti.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DoctrineProfileHint } from './doctrine'

interface PackProfile {
  id: string; unitId: string; label?: string; status?: string; citation?: unknown
  wordMin?: number; wordMax?: number; pageMin?: number; pageMax?: number; minReferences?: number
  sections?: string[]; manualChecks?: string[]; submissionFacts?: string[]
}

let cache: Promise<PackProfile[]> | null = null

async function loadPack(): Promise<PackProfile[]> {
  if (!cache) {
    cache = readFile(path.join(process.cwd(), 'public', 'katedra-pack.json'), 'utf8')
      .then((raw) => (JSON.parse(raw) as { profiles?: PackProfile[] }).profiles ?? [])
      .catch(() => [])
  }
  return cache
}

export async function packProfileHint(profileId?: string): Promise<DoctrineProfileHint | null> {
  if (!profileId) return null
  const profile = (await loadPack()).find((item) => item.id === profileId)
  if (!profile) return null
  const { label, status, wordMin, wordMax, pageMin, pageMax, minReferences, sections, manualChecks, submissionFacts } = profile
  return {
    label, status, wordMin, wordMax, pageMin, pageMax, minReferences, sections, manualChecks, submissionFacts,
    citation: typeof profile.citation === 'string' ? profile.citation : undefined,
  }
}
