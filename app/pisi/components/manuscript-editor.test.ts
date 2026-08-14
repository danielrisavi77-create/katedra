import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('ManuscriptEditor link support', () => {
  it('registers the Tiptap link extension with the shared safe URL validator', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/manuscript-editor.tsx'), 'utf8')

    expect(source).toContain("import Link from '@tiptap/extension-link'")
    expect(source).toContain('Link.configure')
    expect(source).toContain('isSafeManuscriptHref')
  })
})
