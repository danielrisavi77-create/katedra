import rawPack from '../../public/katedra-pack.json'

import { loadAcademicPackFromValue } from './load-pack'
import type { AcademicCatalog } from './types'

let cachedPack: AcademicCatalog | null = null

/** Loads the generated pack for server-only consumers without exposing it through an API. */
export function loadAcademicPack(): AcademicCatalog {
  cachedPack ||= loadAcademicPackFromValue(rawPack)
  return cachedPack
}
