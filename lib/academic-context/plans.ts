import type { AcademicContext, AcademicMethodologyPlan, AcademicRuleStatus, AcademicSourcePlan } from './types'

export function compileAcademicSourcePlan(context: Pick<AcademicContext, 'status' | 'minimumReferences' | 'minimumBooks' | 'citationStyle' | 'sources'>): AcademicSourcePlan {
  const verification = context.status === 'verified'
    ? 'verified_sources_required'
    : context.status === 'generic'
      ? 'general_guidance'
      : 'source_review_required'
  const guidance: string[] = []
  if (context.minimumReferences !== undefined) guidance.push(`Planiraj najmanje ${context.minimumReferences} provjerenih izvora.`)
  if (context.minimumBooks !== undefined) guidance.push(`Uključi najmanje ${context.minimumBooks} knjige među izvorima.`)
  if (context.citationStyle) guidance.push(`Literaturu i citate uskladi sa stilom ${context.citationStyle}.`)
  guidance.push(
    context.status === 'verified'
      ? 'Svaku činjeničnu tvrdnju poveži s izvorom čiji je identitet provjeren.'
      : context.status === 'generic'
        ? 'Koristi izvore kao opću orijentaciju i provjeri ih prema pravilima svog fakulteta.'
        : 'Izvore tretiraj kao prijedlog dok ih korisnik ili mentor ne potvrdi.',
  )
  return {
    ...(context.minimumReferences !== undefined ? { minimumReferences: context.minimumReferences } : {}),
    ...(context.minimumBooks !== undefined ? { minimumBooks: context.minimumBooks } : {}),
    ...(context.citationStyle ? { citationStyle: context.citationStyle } : {}),
    officialSources: context.sources.slice(0, 20),
    verification,
    guidance: guidance.slice(0, 8),
  }
}

export function compileAcademicMethodologyPlan(context: Pick<AcademicContext, 'status' | 'workType' | 'requiredSections' | 'manualChecks' | 'facts'>): AcademicMethodologyPlan {
  const methodologyPattern = /metodolog|metoda|istraživačk|istraživan|research\s+design/i
  const requiredSections = unique(context.requiredSections.filter((section) => methodologyPattern.test(section)))
  const checks = unique(context.manualChecks.filter((check) => methodologyPattern.test(check)))
  const required = requiredSections.length > 0 || checks.length > 0
  const guidance = context.status === 'generic'
    ? ['Ako rad uključuje istraživanje, opiši metodu i provjeri je s mentorom.']
    : context.status === 'verified'
      ? ['Metodološki izbor potvrdi s mentorom prije pisanja istraživačkih dijelova.']
      : ['Metodološki plan tretiraj kao radni prijedlog i potvrdi ga s mentorom.']
  return {
    status: context.status,
    workType: context.workType,
    required,
    requiredSections,
    checks,
    guidance: [...guidance, ...context.facts.filter((fact) => methodologyPattern.test(fact)).slice(0, 4)].slice(0, 6),
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
