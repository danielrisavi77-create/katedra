import type { LegacyWorkType } from '../manuscript/types'

export type ProductModuleId =
  | 'project_plan'
  | 'manuscript_sections'
  | 'contextual_ai'
  | 'sources_verification'
  | 'mentor_tasks'
  | 'local_versions'
  | 'ai_ledger'
  | 'lekta_handoff'

export type FutureProductModuleId =
  | 'research_design_canvas'
  | 'methodology_builder'
  | 'evidence_matrix'
  | 'mentor_review_cycles'
  | 'defense_simulator'

export type ProductModule = {
  id: ProductModuleId | FutureProductModuleId
  label: string
  surface: string
  actionLabel: string
  persistence: string
}

export const PAID_V1_MODULES: readonly ProductModule[] = [
  { id: 'project_plan', label: 'Projekt i Completion Plan', surface: 'Project Home', actionLabel: 'Otvori plan', persistence: 'projektni metapodaci i sljedeći korak' },
  { id: 'manuscript_sections', label: 'Rukopis po sekcijama', surface: 'Pisanje', actionLabel: 'Nastavi pisati', persistence: 'lokalni rukopis i sekcije' },
  { id: 'contextual_ai', label: 'Kontekstualna AI pomoć', surface: 'Pitaj Katedru', actionLabel: 'Pošalji pitanje ili naredbu', persistence: 'lokalni prijedlog i povijest odluka' },
  { id: 'sources_verification', label: 'Izvori i verifikacija', surface: 'Literatura', actionLabel: 'Dodaj i provjeri izvor', persistence: 'lokalna biblioteka izvora i status provjere' },
  { id: 'mentor_tasks', label: 'Mentorovi zadaci', surface: 'Mentor', actionLabel: 'Dodaj ili riješi zadatak', persistence: 'lokalni popis mentorovih zadataka' },
  { id: 'local_versions', label: 'Lokalne verzije', surface: 'Povijest', actionLabel: 'Otvori povijest', persistence: 'lokalni snapshoti rukopisa' },
  { id: 'ai_ledger', label: 'AI zapis', surface: 'Povijest / AI zapis', actionLabel: 'Pregledaj AI zapis', persistence: 'procesni metapodaci bez akademskog teksta' },
  { id: 'lekta_handoff', label: 'Lekta handoff', surface: 'Provjera u Lekti', actionLabel: 'Otvori projekt u Lekti', persistence: 'canonical projectId i handoff metapodaci' },
]

export const FUTURE_PRODUCT_MODULES: readonly ProductModule[] = [
  { id: 'research_design_canvas', label: 'Research Design Canvas', surface: 'Budući modul', actionLabel: 'Nije dostupno u V1', persistence: 'nije implementirano' },
  { id: 'methodology_builder', label: 'Methodology Builder', surface: 'Budući modul', actionLabel: 'Nije dostupno u V1', persistence: 'nije implementirano' },
  { id: 'evidence_matrix', label: 'Evidence Matrix', surface: 'Budući modul', actionLabel: 'Nije dostupno u V1', persistence: 'nije implementirano' },
  { id: 'mentor_review_cycles', label: 'Mentor Review Cycles', surface: 'Budući modul', actionLabel: 'Nije dostupno u V1', persistence: 'nije implementirano' },
  { id: 'defense_simulator', label: 'Defense Simulator', surface: 'Budući modul', actionLabel: 'Nije dostupno u V1', persistence: 'nije implementirano' },
]

export function passModulesForWorkType(_workType: LegacyWorkType): readonly ProductModule[] {
  return PAID_V1_MODULES
}
