import { validateManuscriptBackup } from './backup-validation'
import type { ManuscriptV1 } from './types'

export function validateStoredManuscript(value: unknown, projectId: string): ManuscriptV1 | null {
  const result = validateManuscriptBackup(value, projectId)
  return result.ok ? result.value : null
}
