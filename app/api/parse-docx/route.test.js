import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, it } from 'vitest'

it('hardens DOCX parsing with format validation, timeout, rate limiting, and a reduced text ceiling', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/api/parse-docx/route.js'), 'utf8')

  expect(source).toContain('validateDocxBuffer')
  expect(source).toContain('reserveDocxUpload')
  expect(source).toContain('EXTRACTION_TIMEOUT_MS')
  expect(source).toContain('MAX_TEXT_CHARS = 250_000')
})
