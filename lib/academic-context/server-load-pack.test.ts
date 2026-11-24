import { describe, expect, it } from 'vitest'

import { loadAcademicPack } from './server-load-pack'

describe('server academic pack loader', () => {
  it('loads the generated pack with rich profiles', () => {
    const catalog = loadAcademicPack()
    expect(catalog.units.length).toBeGreaterThan(100)
    expect(catalog.profiles.length).toBeGreaterThan(300)
    expect(catalog.profiles.find((profile) => profile.id === 'fpzg-politologija-diplomski')?.wordMin).toBe(10000)
  })
})
