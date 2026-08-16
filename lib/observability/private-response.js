export function privateJson(body, init = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('cache-control')) headers.set('cache-control', 'private, no-store')
  return Response.json(body, { ...init, headers })
}
