type StatePayload = Record<string, unknown>

export function stripManuscriptFromStatePayload<T extends StatePayload>(input: T): Omit<T, 'manuscript'> {
  const { manuscript: _manuscript, ...payload } = input
  if (payload.gen && typeof payload.gen === 'object' && !Array.isArray(payload.gen)) {
    const { manuscript: _nestedManuscript, ...safeGen } = payload.gen as Record<string, unknown>
    return { ...payload, gen: safeGen } as Omit<T, 'manuscript'>
  }
  return payload as Omit<T, 'manuscript'>
}
