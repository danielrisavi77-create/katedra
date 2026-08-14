import type { AcademicWorkType } from '@/lib/academic-suite/contracts'

export type ProductTier = 'free' | 'seminarski' | 'zavrsni' | 'diplomski'

export type ProjectStage =
  | 'started'
  | 'scanned'
  | 'planned'
  | 'researching'
  | 'writing'
  | 'review'
  | 'lekta'
  | 'defense'
  | 'completed'

export type ProjectCapability =
  | 'completion_scan'
  | 'basic_plan'
  | 'lekta_free_check'
  | 'section_writing'
  | 'full_generation'
  | 'source_suggestions'
  | 'web_research'
  | 'mentor_review'
  | 'methodology'
  | 'research_design'
  | 'data_analysis'
  | 'multiple_reviews'
  | 'defense_simulator'
  | 'autonomous_run'

export type KatedraWorkType = 'seminarski' | 'zavrsni' | 'diplomski'

export const PRODUCT_TIER_BY_WORK_TYPE: Record<KatedraWorkType, ProductTier> = {
  seminarski: 'seminarski',
  zavrsni: 'zavrsni',
  diplomski: 'diplomski',
}

export const PRODUCT_TIER_BY_CANONICAL_WORK_TYPE: Record<Extract<AcademicWorkType, 'seminar' | 'final' | 'graduate'>, ProductTier> = {
  seminar: 'seminarski',
  final: 'zavrsni',
  graduate: 'diplomski',
}

export function productTierForWorkType(value: unknown): ProductTier | null {
  if (value === 's' || value === 'seminar' || value === 'seminarski') return 'seminarski'
  if (value === 'z' || value === 'final' || value === 'zavrsni') return 'zavrsni'
  if (value === 'd' || value === 'graduate' || value === 'diplomski') return 'diplomski'
  return null
}

export function isPaidProductTier(value: ProductTier): value is Exclude<ProductTier, 'free'> {
  return value !== 'free'
}
