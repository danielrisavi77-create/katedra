import type { AcademicContext } from '../academic-context/types'

export type ProjectCurrentState = 'no_topic' | 'topic' | 'outline' | 'draft' | 'review' | 'almost_done'

export interface CompletionScanInput {
  startMode: 'new' | 'existing'
  currentState: ProjectCurrentState
  title: string
  importedText: string
  mentor: string
  deadline: string
  materials: string[]
  academicContext?: AcademicContext
}

export interface CompletionScan {
  stage: 'started' | 'scanned' | 'planned' | 'writing' | 'review'
  strengths: string[]
  missing: string[]
  nextActions: string[]
  hasExistingDraft: boolean
  academicContext?: AcademicContext
}

export function createCompletionScan(input: CompletionScanInput): CompletionScan {
  const strengths: string[] = []
  const missing: string[] = []
  const hasExistingDraft = Boolean(input.importedText.trim())

  if (input.title.trim()) strengths.push('Imaš početnu temu ili naslov rada.')
  else missing.push('definirati temu ili radni naslov')
  if (input.mentor.trim()) strengths.push('Mentor je zabilježen u projektu.')
  else missing.push('dodati mentora ili potvrditi da još nije poznat')
  if (input.deadline) strengths.push('Rok predaje je postavljen.')
  else missing.push('postaviti rok predaje')
  if (input.materials.length) strengths.push(`Imaš ${input.materials.length} pripremljen${input.materials.length === 1 ? ' materijal' : 'a materijala'}.`)
  else if (!hasExistingDraft) missing.push('dodati postojeći tekst, upute ili literaturu')
  if (hasExistingDraft) strengths.push('Postojeći tekst može poslužiti kao početna verzija.')

  const context = input.academicContext
  const sourcePlan = context?.sourcePlan
  const methodologyPlan = context?.methodologyPlan
  if (context) {
    if (context.status === 'verified') strengths.push(`Profil ${context.profileLabel} ima verificirana pravila${context.verifiedAt ? ` (${context.verifiedAt})` : ''}.`)
    else strengths.push('Profil nije u potpunosti verificiran; prikazujemo opće akademske smjernice.')
    if (context.wordRange?.min || context.wordRange?.max) strengths.push(`Ciljani opseg je ${formatRange(context.wordRange.min, context.wordRange.max)} riječi.`)
    if (context.citationStyle) strengths.push(`Predloženi citatni stil: ${context.citationStyle}.`)
    if (context.minimumReferences) missing.push(`pripremiti najmanje ${context.minimumReferences} provjerenih izvora`)
    if (context.minimumBooks) missing.push(`uključiti najmanje ${context.minimumBooks} knjige`)
    if (context.requiredSections.length) missing.push(`uskladiti plan s obveznim sekcijama: ${context.requiredSections.slice(0, 4).join(', ')}`)
    if (sourcePlan?.guidance[0]) missing.push(sourcePlan.guidance[0])
    if (methodologyPlan?.required && methodologyPlan.checks.length) missing.push(`provjeriti metodološki plan: ${methodologyPlan.checks.slice(0, 2).join(', ')}`)
  }

  const stage = input.currentState === 'no_topic'
    ? 'started'
    : input.currentState === 'topic'
      ? 'scanned'
      : input.currentState === 'outline'
        ? 'planned'
        : input.currentState === 'draft'
          ? 'writing'
          : 'review'

  const genericNextActions = stage === 'started'
    ? ['Odredi temu i osnovno istraživačko pitanje.', 'Odaberi strukturu rada.', 'Pripremi prve izvore ili upute mentora.']
    : stage === 'scanned'
      ? ['Pretvori temu u jasan plan poglavlja.', 'Prikupi i provjeri početne izvore.', 'Dogovori opseg rada s mentorom.']
      : stage === 'planned'
        ? ['Provjeri redoslijed i cilj svakog poglavlja.', 'Započni s prvim odlomkom.', 'Označi izvore koje treba dodatno provjeriti.']
        : stage === 'writing'
          ? ['Nastavi najbliže nedovršeno poglavlje.', 'Poveži tvrdnje s provjerenim izvorima.', 'Zatraži sadržajnu reviziju prije izvoza.']
          : ['Prođi otvorene nalaze i komentare.', 'Izvezi zadnju lokalnu verziju u DOCX.', 'Pošalji dokument u Lektu na tehničku provjeru.']

  const academicNextActions = context ? [
    context.requiredSections.length ? `Uskladi outline s obveznim sekcijama: ${context.requiredSections.slice(0, 3).join(', ')}.` : 'Uskladi outline s pravilima odabranog profila.',
    context.minimumReferences ? `Pripremi najmanje ${context.minimumReferences} provjerenih izvora${context.minimumBooks ? ` i ${context.minimumBooks} knjige` : ''}.` : 'Provjeri koje izvore zahtijeva odabrani profil.',
    context.citationStyle ? `Piši uz citatni stil ${context.citationStyle}.` : 'Provjeri citatni stil s mentorom.',
  ] : genericNextActions

  return { stage, strengths, missing, nextActions: academicNextActions.slice(0, 3), hasExistingDraft, ...(context ? { academicContext: context } : {}) }
}

function formatRange(min?: number, max?: number): string {
  const format = (value: number) => new Intl.NumberFormat('hr-HR').format(value)
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`
  if (min !== undefined) return `najmanje ${format(min)}`
  return `najviše ${format(max || 0)}`
}
