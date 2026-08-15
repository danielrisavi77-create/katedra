export type NextAction = {
  title: string
  detail: string
  cta: string
  destination: 'writing' | 'preparation' | 'sources' | 'review' | 'lekta'
}

export function resolveNextAction(input: {
  stage: string
  totalWords: number
  sectionCount: number
  reviewSectionCount: number
  hasMaterials: boolean
  passActive: boolean
}): NextAction {
  if (input.stage === 'started' || input.stage === 'scanned' || input.sectionCount === 0 || !input.hasMaterials) {
    return {
      title: 'Pripremi osnovu projekta.',
      detail: input.hasMaterials
        ? 'Dovrši temu i plan poglavlja prije nastavka rada.'
        : 'Dodaj upute, postojeći tekst ili literaturu kako bi projekt imao provjerljiv kontekst.',
      cta: 'Pripremi projekt',
      destination: 'preparation',
    }
  }

  const action = input.stage === 'lekta' || input.stage === 'completed'
    ? {
        title: 'Pošalji DOCX na tehničku provjeru.',
        detail: 'Lekta je jedino mjesto za provjeru tehničke usklađenosti dokumenta.',
        cta: 'Otvori Lektu',
        destination: 'lekta' as const,
      }
    : input.stage === 'review' || input.reviewSectionCount > 0
      ? {
          title: 'Pregledaj sekcije spremne za reviziju.',
          detail: `${input.reviewSectionCount || input.sectionCount} ${pluralSection(input.reviewSectionCount || input.sectionCount)} čeka tvoju potvrdu.`,
          cta: 'Otvori reviziju',
          destination: 'review' as const,
        }
      : {
          title: input.totalWords > 0 ? 'Nastavi pisati rukopis.' : 'Započni s prvim odlomkom.',
          detail: input.totalWords > 0
            ? 'Vrati se aktivnoj sekciji i razvij argument uz dostupne materijale.'
            : 'Plan i materijali su spremni za prvi nacrt.',
          cta: 'Nastavi',
          destination: 'writing' as const,
        }

  if (input.passActive) return action

  return {
    title: 'Aktiviraj Pass za ovaj korak.',
    detail: `${action.title.replace(/[.]$/, '')} zahtijeva aktivan Pass za ovaj projekt.`,
    cta: 'Aktiviraj Pass',
    destination: 'preparation',
  }
}

function pluralSection(count: number): string {
  return count === 1 ? 'sekcija' : 'sekcije'
}
