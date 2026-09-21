const SAME_ORIGIN_ERROR = 'Zahtjev nije poslan iz dopuštenog izvora.'

function configuredOrigins(extraOrigins = []) {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.KATEDRA_ALLOWED_ORIGINS || '').split(','),
    ...extraOrigins,
  ]

  return new Set(values.map(value => {
    try {
      return new URL(String(value).trim()).origin
    } catch {
      return ''
    }
  }).filter(Boolean))
}

/**
 * Defense-in-depth for cookie-authenticated state-changing routes.
 *
 * Requests without Origin are rejected by default for cookie-authenticated
 * mutations. A server-to-server caller must explicitly opt into
 * `allowMissingOrigin`; browser routes should never use that opt-in in
 * production. When browser provenance headers are present, a cross-site
 * request or an unrecognized Origin is rejected before parsing the body or
 * performing any mutation.
 */
export function validateSameOriginRequest(request, options = {}) {
  const origin = request.headers.get('origin')?.trim() || ''
  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase() || ''

  if (fetchSite === 'cross-site') return rejected()

  if (!origin) return options.allowMissingOrigin === true ? { ok: true } : rejected()
  if (origin === 'null') return rejected()

  let requestOrigin = ''
  try {
    requestOrigin = new URL(request.url).origin
  } catch {
    return rejected()
  }

  const allowed = configuredOrigins(options.allowedOrigins)
  allowed.add(requestOrigin)

  return allowed.has(origin) ? { ok: true } : rejected()
}

function rejected() {
  return { ok: false, status: 403, error: SAME_ORIGIN_ERROR }
}

export function sameOriginErrorResponse(result) {
  return result.ok ? null : Response.json({ error: result.error }, { status: result.status })
}
