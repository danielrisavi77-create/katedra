import type { AcademicContext } from './types'

export function academicContextExportWarning(context?: AcademicContext | null): string {
  const lines = ['DOCX je izrađen iz rukopisa, ali nije tehnički verificiran.']
  if (context) {
    lines.push(`Akademski profil: ${context.profileId || context.profileLabel}.`)
    lines.push(`Status pravila: ${context.status}${context.verifiedAt ? `; provjereno ${context.verifiedAt}` : ''}.`)
    if (context.freshness?.isStale) lines.push('Datum provjere je stariji od preporučenog roka; provjeri aktualne upute.')
    if (context.wordRange?.min !== undefined || context.wordRange?.max !== undefined) lines.push(`Ciljani opseg: ${formatRange(context.wordRange.min, context.wordRange.max)} riječi.`)
    if (context.sourcePlan?.minimumReferences !== undefined) lines.push(`Najmanje ${context.sourcePlan.minimumReferences} izvora.`)
    if (context.sourcePlan?.minimumBooks !== undefined) lines.push(`Najmanje ${context.sourcePlan.minimumBooks} knjiga.`)
    if (context.citationStyle) lines.push(`Citatni stil: ${context.citationStyle}.`)
    const source = context.sourcePlan?.officialSources[0] || context.sources[0]
    if (source) lines.push(`Službeni izvor pravila: ${source.title} (${source.url}).`)
  }
  lines.push('Otvori ga u Wordu i provjeri u Lekti prije predaje.')
  return lines.join('\n')
}

export function academicHandoffParams(context?: AcademicContext | null): Record<string, string> {
  if (!context) return {}
  const params: Record<string, string> = {
    ...(context.profileId ? { profile: context.profileId } : {}),
    rulesStatus: context.status,
    ...(context.verifiedAt ? { rulesVerifiedAt: context.verifiedAt } : {}),
    ...(context.freshness?.isStale ? { rulesFreshness: 'stale' } : {}),
    ...(context.wordRange?.min !== undefined ? { rulesMinWords: String(context.wordRange.min) } : {}),
    ...(context.wordRange?.max !== undefined ? { rulesMaxWords: String(context.wordRange.max) } : {}),
    ...(context.sourcePlan?.minimumReferences !== undefined ? { rulesMinReferences: String(context.sourcePlan.minimumReferences) } : {}),
    ...(context.sourcePlan?.minimumBooks !== undefined ? { rulesMinBooks: String(context.sourcePlan.minimumBooks) } : {}),
    ...(context.citationStyle ? { citationStyle: context.citationStyle } : {}),
  }
  const source = context.sourcePlan?.officialSources[0] || context.sources[0]
  if (source?.url) params.rulesSource = source.url
  return params
}

function formatRange(min?: number, max?: number): string {
  const format = (value: number) => new Intl.NumberFormat('hr-HR').format(value)
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`
  if (min !== undefined) return `najmanje ${format(min)}`
  return `najviše ${format(max || 0)}`
}
