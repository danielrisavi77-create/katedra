export function createWithdrawalReference(randomUuid = () => globalThis.crypto?.randomUUID?.()) {
  const generated = typeof randomUuid === 'function' ? randomUuid() : ''
  if (typeof generated === 'string' && generated.trim()) return generated.trim().slice(0, 200)
  return `withdrawal-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}
