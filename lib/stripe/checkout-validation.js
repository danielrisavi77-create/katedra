import { KATEDRA_PACKAGES } from './catalog'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TOPIC_LENGTH = 500

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
  const normalizedTopic = topic.trim()
  if (normalizedTopic.length > MAX_TOPIC_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalizedTopic)) {
    return { ok: false, status: 400, error: 'Tema projekta je preduga ili sadrĹľi nedopuĹˇtene znakove.' }
  }
  if (projectTopic !== undefined && projectTopic !== null && typeof projectTopic !== 'string') {
    return { ok: false, status: 409, error: 'Tema spremljena u projektu nije valjana.' }
  }
  const normalizedProjectTopic = typeof projectTopic === 'string' ? projectTopic.trim() : ''
  if (normalizedProjectTopic.length > MAX_TOPIC_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalizedProjectTopic)) {
    return { ok: false, status: 409, error: 'Tema spremljena u projektu nije valjana.' }
  }
  if (normalizedProjectTopic && normalizedTopic !== normalizedProjectTopic) {
    return { ok: false, status: 409, error: 'Tema se razlikuje od teme spremljene u projektu.' }
  }
  return { ok: true }
}

export { UUID_RE }
