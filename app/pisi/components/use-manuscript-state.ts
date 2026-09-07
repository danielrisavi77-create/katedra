'use client'

import { useCallback, useRef, useState, type SetStateAction } from 'react'
import type { ManuscriptV1 } from '../../../lib/manuscript/types'

/** Invalidate asynchronous initialization when an edit is queued, not rendered. */
export function useManuscriptState() {
  const [manuscript, commit] = useState<ManuscriptV1 | null>(null)
  const revision = useRef(0)
  const setManuscript = useCallback((value: SetStateAction<ManuscriptV1 | null>) => {
    revision.current += 1
    commit(value)
  }, [])
  return [manuscript, setManuscript, revision] as const
}
