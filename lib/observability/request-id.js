const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/

export function getRequestId(request) {
  const incoming = request?.headers?.get?.('x-request-id')?.trim()
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID()
}

export function createRequestContext(request) {
  return {
    traceRequestId: getRequestId(request),
    reservationRequestId: crypto.randomUUID(),
  }
}

export function withRequestId(response, requestId) {
  if (response?.headers && requestId) response.headers.set('x-request-id', requestId)
  return response
}
