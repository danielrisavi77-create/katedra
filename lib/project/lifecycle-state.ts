import type { ProjectStage } from '../product/lifecycle'

export type LifecycleLektaSummary = {
  score: number | null
  checkedAt: string
  issues: Array<{ status?: string; severity?: string }>
}

export function isCleanLektaResult(summary: LifecycleLektaSummary): boolean {
  if (!summary.checkedAt || summary.score === null || summary.score < 100) return false
  return summary.issues.every((issue) => ['fixed', 'resolved', 'closed'].includes((issue.status || 'open').toLocaleLowerCase('en-US')))
}

export function resolveManuscriptProjectStage(input: {
  scanStage?: string
  totalWords: number
  sections: Array<{ status: string }>
  lektaSummary: LifecycleLektaSummary
}): ProjectStage {
  const allApproved = input.sections.length > 0 && input.sections.every((section) => section.status === 'approved')
  if (allApproved) return isCleanLektaResult(input.lektaSummary) ? 'completed' : 'lekta'
  if (input.sections.some((section) => section.status === 'review')) return 'review'
  if (input.totalWords > 0 || input.sections.some((section) => section.status !== 'empty')) return 'writing'
  return isProjectStage(input.scanStage) ? input.scanStage : 'started'
}

function isProjectStage(value: string | undefined): value is ProjectStage {
  return value === 'started' || value === 'scanned' || value === 'planned' || value === 'researching' || value === 'writing' || value === 'review' || value === 'lekta' || value === 'defense' || value === 'completed'
}
