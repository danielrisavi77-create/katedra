import { KATEDRA_PACKAGES } from './catalog'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateCheckoutProject(project, packageKey) {
  const pkg = KATEDRA_PACKAGES[packageKey]
  if (!pkg) return { ok: false, status: 400, error: 'Nepoznat paket.' }
  if (!UUID_RE.test(project?.projectId || '')) {
    return { ok: false, status: 409, error: 'Projekt još nije sinkroniziran s računom.' }
  }
  if (project?.workTypeCanonical !== pkg.workType) {
    return { ok: false, status: 400, error: 'Vrsta rada u projektu ne odgovara odabranom paketu.' }
  }
  return { ok: true }
}

export function validateCheckoutConfirmation({ topic, projectTopic, lockConfirmation }) {
  if (lockConfirmation !== true) {
    return { ok: false, status: 400, error: 'Potvrdi da razumiješ zaključavanje teme prije naplate.' }
  }
  if (typeof topic !== 'string' || !topic.trim()) {
    return { ok: false, status: 400, error: 'Nedostaje tema projekta.' }
  }
  if (typeof projectTopic === 'string' && projectTopic.trim() && topic.trim() !== projectTopic.trim()) {
    return { ok: false, status: 409, error: 'Tema se razlikuje od teme spremljene u projektu.' }
  }
  return { ok: true }
}

export { UUID_RE }
