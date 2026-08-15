export type ProjectCurrentState = 'no_topic' | 'topic' | 'outline' | 'draft' | 'review' | 'almost_done'

export interface CompletionScanInput {
  startMode: 'new' | 'existing'
  currentState: ProjectCurrentState
  title: string
  importedText: string
  mentor: string
  deadline: string
  materials: string[]
}

export interface CompletionScan {
  stage: 'started' | 'scanned' | 'planned' | 'writing' | 'review'
  strengths: string[]
  missing: string[]
  nextActions: string[]
  hasExistingDraft: boolean
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
  else missing.push('dodati postojeći tekst, upute ili literaturu')
  if (hasExistingDraft) strengths.push('Postojeći tekst može poslužiti kao početna verzija.')

  const stage = input.currentState === 'no_topic'
    ? 'started'
    : input.currentState === 'topic'
      ? 'scanned'
      : input.currentState === 'outline'
        ? 'planned'
        : input.currentState === 'draft'
          ? 'writing'
          : 'review'

  const nextActions = stage === 'started'
    ? ['Odredi temu i osnovno istraživačko pitanje.', 'Odaberi strukturu rada.', 'Pripremi prve izvore ili upute mentora.']
    : stage === 'scanned'
      ? ['Pretvori temu u jasan plan poglavlja.', 'Prikupi i provjeri početne izvore.', 'Dogovori opseg rada s mentorom.']
      : stage === 'planned'
        ? ['Provjeri redoslijed i cilj svakog poglavlja.', 'Započni s prvim odlomkom.', 'Označi izvore koje treba dodatno provjeriti.']
        : stage === 'writing'
          ? ['Nastavi najbliže nedovršeno poglavlje.', 'Poveži tvrdnje s provjerenim izvorima.', 'Zatraži sadržajnu reviziju prije izvoza.']
          : ['Prođi otvorene nalaze i komentare.', 'Izvezi zadnju lokalnu verziju u DOCX.', 'Pošalji dokument u Lektu na tehničku provjeru.']

  return { stage, strengths, missing, nextActions, hasExistingDraft }
}
