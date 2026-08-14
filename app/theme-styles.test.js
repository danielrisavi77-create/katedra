import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appDirectory = resolve(process.cwd(), 'app')

describe('dark theme style contracts', () => {
  it('keeps the global dark palette later than legacy skin palettes', () => {
    const styles = readFileSync(resolve(appDirectory, 'katedra-scoped.css'), 'utf8')

    expect(styles.lastIndexOf("html[data-theme='dark'] .katedra-page[data-skin]")).toBeGreaterThan(
      styles.lastIndexOf('.katedra-page[data-skin="kreda"]'),
    )
  })

  it('uses an accessible foreground token for manuscript accent controls', () => {
    const styles = readFileSync(resolve(appDirectory, 'pisi', 'pisi.css'), 'utf8')

    expect(styles).toContain('--pis-on-accent: #132331')
    expect(styles).toContain('.pis-export-button')
    expect(styles).toContain('color: var(--pis-on-accent)')
  })
})
