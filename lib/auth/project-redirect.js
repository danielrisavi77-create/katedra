export function buildProjectAuthRedirect(projectId, destination = '/pisi') {
  if (typeof projectId !== 'string' || !projectId.trim()) return destination

  const target = new URL(destination, 'https://katedra.local')
  if (target.origin !== 'https://katedra.local' || !target.pathname.startsWith('/')) return '/pisi'
  target.searchParams.set('projectId', projectId.trim())
  return `${target.pathname}${target.search}${target.hash}`
}
