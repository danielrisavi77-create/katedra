import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/pisi/components/project-drawer.tsx'), 'utf8')

describe('project drawer source copy', () => {
  it('describes source identity verification without claiming semantic truth', () => {
    expect(source).toContain("'Identitet izvora provjeren'")
    expect(source).toContain("'provjeri prije uporabe'")
    expect(source).not.toContain("source.verified ? 'provjereno'")
  })
})
