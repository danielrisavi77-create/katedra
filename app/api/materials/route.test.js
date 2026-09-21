import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('keeps temporary material uploads behind the project and private storage contracts', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/materials/route.js'), 'utf8')

  expect(source).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
  expect(source).not.toContain("import { createAdminClient } from '@/lib/supabase/server'")
  expect(source).toContain('KATEDRA_MATERIALS_ENABLED')
  expect(source).toContain('resolveCanonicalProjectPass')
  expect(source).not.toContain('resolveProjectCapability')
  expect(source).toContain('.storage.from')
  expect(source).toContain('asset')
  expect(source).toContain('manifest')
  expect(source).toContain('expiresAt')
  expect(source).toContain('reserveDistributedRequest')
  expect(source).toContain('isDistributedRateLimitConfigured')
  expect(source).toContain('readMultipartForm')
  expect(source).not.toContain('.formData(')
  expect(source).toContain('MATERIAL_LIMITS.maxBytes')
  expect(source).toContain('releaseRateLimitReservation(reservation')
  expect(source).toContain('return privateJson({ asset: stored.asset')
  expect(source).toContain('storeMaterialPayload(createAdminClient()')
  expect(source).not.toContain('removeTemporaryObjects')
})
