// Shared state keeps bounded finding metadata. This projects Lekta's findings;
// it neither checks a DOCX nor upgrades any finding's verification status.
const MAX_COUNT = 250
const STRING_FIELDS = { id: 200, ruleId: 200, checkId: 200, category: 80, fixerId: 200, label: 280 }
const SEVERITIES = new Set(['critical', 'error', 'warning', 'info'])
const STATUSES = new Set(['OPEN', 'USER_CHANGED', 'RECHECK_REQUIRED', 'VERIFIED_FIXED', 'SKIPPED'])

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized && normalized.length <= maxLength ? normalized : undefined
}

export function sanitizeLektaIssues(raw: unknown): Record<string, string | boolean>[] {
  if (!Array.isArray(raw)) return []
  const safeIssues: Record<string, string | boolean>[] = []
  for (const candidate of raw.slice(0, MAX_COUNT)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const issue = candidate as Record<string, unknown>
    const id = boundedString(issue.id, STRING_FIELDS.id)
    if (!id) continue
    const safe: Record<string, string | boolean> = { id }
    for (const [key, maxLength] of Object.entries(STRING_FIELDS)) {
      if (key === 'id') continue
      const value = boundedString(issue[key], maxLength)
      if (value !== undefined) safe[key] = value
    }
    if (typeof issue.severity === 'string' && SEVERITIES.has(issue.severity)) safe.severity = issue.severity
    if (typeof issue.fixable === 'boolean') safe.fixable = issue.fixable
    if (typeof issue.status === 'string' && STATUSES.has(issue.status)) safe.status = issue.status
    safeIssues.push(safe)
  }
  return safeIssues
}
