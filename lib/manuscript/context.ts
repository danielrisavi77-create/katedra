import { documentText } from './model'
import type { ManuscriptV1 } from './types'

export type ManuscriptAiAction =
  | 'draft'
  | 'expand'
  | 'shorten'
  | 'improve'
  | 'review'
  | 'mentor'
  | 'coach'
  | 'next'

const ACTION_INSTRUCTIONS: Record<ManuscriptAiAction, string> = {
  draft: 'Napiši nacrt ove sekcije prema outlineu i dostupnim provjerenim izvorima.',
  expand: 'Razradi označeni tekst bez dodavanja neprovjerenih činjenica.',
  shorten: 'Skrati označeni tekst bez gubitka tvrdnji, citata i brojki.',
  improve: 'Poboljšaj jasnoću, argument i akademski registar ovog teksta.',
  review: 'Daj sadržajnu recenziju argumenta, dokaza i logičkih rupa. Ne provjeravaj DOCX format.',
  mentor: 'Pretvori mentorov komentar u konkretan plan izmjene i predloži tekst tek nakon potvrde.',
  coach: 'Vodi me sokratskim pitanjima; nemoj pisati tekst za predaju umjesto mene.',
  next: 'Predloži jednu sljedeću radnju koja najviše pomiče ovaj rad naprijed.',
}

export function buildAiMessages({
  manuscript,
  sectionId,
  action,
  selectionText,
  instruction,
}: {
  manuscript: ManuscriptV1
  sectionId: string
  action: ManuscriptAiAction
  selectionText?: string
  instruction?: string
}) {
  const section = manuscript.sections.find((item) => item.id === sectionId)
  if (!section) throw new Error('Aktivna sekcija ne postoji.')
  const outline = manuscript.sections.map((item, index) => `${index + 1}. ${item.title}`).join('\n')
  const sourceList = manuscript.sources.length
    ? manuscript.sources.map((source) => `- ${source.title}${source.year ? ` (${source.year})` : ''}${source.verified ? ' [korisnik provjerio]' : ' [neprovjereno]'}`).join('\n')
    : '- Nema dodanih izvora. Ne izmišljaj izvore ni bibliografske podatke.'
  const target = selectionText?.trim() || documentText(section.content) || '[sekcija je prazna]'
  const prompt = [
    `RAD: ${manuscript.title || 'rad bez konačnog naslova'}`,
    `VRSTA: ${manuscript.workType}`,
    `AKTIVNA SEKCIJA: ${section.title}`,
    '',
    'OUTLINE:',
    outline,
    '',
    'DOSTUPNI IZVORI:',
    sourceList,
    '',
    selectionText?.trim() ? 'OZNAČENI TEKST:' : 'TEKST AKTIVNE SEKCIJE:',
    target,
    '',
    'ZADATAK:',
    instruction?.trim() || ACTION_INSTRUCTIONS[action],
    '',
    'Vrati samo prijedlog za ovaj zadatak. Jasno označi što korisnik mora ručno provjeriti. Ne tvrdi da si tehnički provjerio DOCX.',
  ].join('\n')

  return [{ role: 'user' as const, content: prompt }]
}

export function capabilityForAction(action: ManuscriptAiAction): string {
  return ['draft', 'expand', 'improve'].includes(action) ? 'generate_large_sections' : 'contextual_ai'
}
