import { crc32, deflateRawSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { checkZipResourceBounds } from './zip-resource-check'
import { zipFixture } from './zip-fixture'

const limits = { maxEntries: 10, maxExpandedBytes: 200, maxRatio: 100 }

it.each(['word/document.xml', '../word/document.xml'])('rejects Unicode Path overrides hidden in ZIP extra fields: %s', (effectiveName) => {
  const name = 'safe.txt'
  const encoded = Buffer.from(effectiveName)
  const extra = Buffer.alloc(9 + encoded.length)
  extra.writeUInt16LE(0x7075, 0)
  extra.writeUInt16LE(5 + encoded.length, 2)
  extra[4] = 1
  extra.writeUInt32LE(crc32(Buffer.from(name)), 5)
  encoded.copy(extra, 9)
  expect(checkZipResourceBounds(zipFixture([{ name, text: 'small', extra }]), limits).ok).toBe(false)
})

it('rejects additional compressed streams instead of inspecting only their first output', () => {
  const archive = zipFixture([{ name: 'one.txt', text: 'small', compressedTail: deflateRawSync(Buffer.from('hidden second stream')) }])
  expect(checkZipResourceBounds(archive, limits).ok).toBe(false)
})

it('bounds aggregate expansion and entry counts using real containers', () => {
  const archive = zipFixture([{ name: 'one.txt', text: 'a'.repeat(120), stored: true }, { name: 'two.txt', text: 'b'.repeat(120), stored: true }])
  expect(checkZipResourceBounds(archive, limits).ok).toBe(false)
  expect(checkZipResourceBounds(zipFixture(), { ...limits, maxEntries: 1 }).ok).toBe(false)
})

it.each(['../one.txt', '/one.txt', 'C:/one.txt', 'folder\\one.txt'])('rejects an ambiguous or unsafe entry path: %s', (name) => {
  expect(checkZipResourceBounds(zipFixture([{ name, text: 'small' }]), limits).ok).toBe(false)
})

it('rejects duplicated names and disagreeing local headers', () => {
  expect(checkZipResourceBounds(zipFixture([{ name: 'one.txt', text: 'a' }, { name: 'one.txt', text: 'b' }]), limits).ok).toBe(false)
  const archive = zipFixture()
  archive[30] = 120
  expect(checkZipResourceBounds(archive, limits).ok).toBe(false)
})

it('rejects a second end signature hidden in a ZIP comment', () => {
  const archive = zipFixture()
  const comment = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0])
  archive.writeUInt16LE(comment.length, archive.length - 2)
  expect(checkZipResourceBounds(Buffer.concat([archive, comment]), limits).ok).toBe(false)
})
