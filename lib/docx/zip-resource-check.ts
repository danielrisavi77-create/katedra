import { inflateRawSync } from 'node:zlib'

type Limits = { maxEntries: number; maxExpandedBytes: number; maxRatio: number }
type Result = { ok: true; names: Set<string> } | { ok: false; error: string }
const invalid = (): Result => ({ ok: false, error: 'Oštećen ili nepodržan DOCX ZIP zapis.' })

function unambiguousExtraFields(extra: Buffer, name: Buffer): boolean {
  let offset = 0
  while (offset < extra.length) {
    if (offset + 4 > extra.length) return false
    const kind = extra.readUInt16LE(offset)
    const length = extra.readUInt16LE(offset + 2)
    const next = offset + 4 + length
    if (next > extra.length) return false
    // JSZip can honor Unicode Path instead of the raw name. Accept it only
    // when it repeats that same name, so downstream identity cannot diverge.
    if (kind === 0x7075 && (length < 5 || !extra.subarray(offset + 9, next).equals(name))) return false
    offset = next
  }
  return true
}

/** Upload resource safety only; does not inspect XML or certify DOCX compliance. */
export function checkZipResourceBounds(buffer: Buffer, limits: Limits): Result {
  let end = -1
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 22 - 65_535); at--) {
    if (buffer.readUInt32LE(at) === 0x06054b50 && at + 22 + buffer.readUInt16LE(at + 20) === buffer.length) { end = at; break }
  }
  if (end < 0 || buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) !== end
    || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) return invalid()
  const count = buffer.readUInt16LE(end + 10)
  const directorySize = buffer.readUInt32LE(end + 12)
  const directoryStart = buffer.readUInt32LE(end + 16)
  // Multi-disk/ZIP64 and inconsistent directories cannot establish a bound.
  if (count < 1 || count > limits.maxEntries || count !== buffer.readUInt16LE(end + 8)
    || directoryStart + directorySize !== end) return invalid()

  let offset = directoryStart
  let expandedTotal = 0
  const names = new Set<string>()
  const ranges: Array<{ start: number; end: number }> = []
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return invalid()
    const flags = buffer.readUInt16LE(offset + 8)
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const declaredSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const next = offset + 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    const local = buffer.readUInt32LE(offset + 42)
    if (flags & 0x2041 || (method !== 0 && method !== 8) || next > end || !nameLength
      || buffer.readUInt16LE(offset + 34) !== 0 || local + 30 > directoryStart) return invalid()
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength)
    let name: string
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes) } catch { return invalid() }
    if (names.has(name) || name.includes('\0') || name.includes('\\') || name.startsWith('/')
      || /^[A-Za-z]:/.test(name) || name.split('/').some(part => part === '..' || part === '.')) return invalid()
    if (buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 6) !== flags
      || buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 26) !== nameLength) return invalid()
    const dataStart = local + 30 + nameLength + buffer.readUInt16LE(local + 28)
    const dataEnd = dataStart + compressedSize
    if (dataEnd > directoryStart || !buffer.subarray(local + 30, local + 30 + nameLength).equals(nameBytes)) return invalid()
    if (!unambiguousExtraFields(buffer.subarray(offset + 46 + nameLength, offset + 46 + nameLength + buffer.readUInt16LE(offset + 30)), nameBytes)
      || !unambiguousExtraFields(buffer.subarray(local + 30 + nameLength, dataStart), nameBytes)) return invalid()
    if (!(flags & 8) && (buffer.readUInt32LE(local + 18) !== compressedSize || buffer.readUInt32LE(local + 22) !== declaredSize)) return invalid()
    if (ranges.some(range => local < range.end && dataEnd > range.start)) return invalid()
    ranges.push({ start: local, end: dataEnd })

    const remaining = limits.maxExpandedBytes - expandedTotal
    if (declaredSize > remaining || (compressedSize === 0 ? declaredSize > 0 : declaredSize / compressedSize > limits.maxRatio)) {
      return { ok: false, error: 'DOCX sadrži previše raspakiranih podataka ili sumnjiv omjer kompresije.' }
    }
    try {
      const compressed = buffer.subarray(dataStart, dataEnd)
      // Do not trust the declaration: zlib stops output just past the smallest
      // asserted/budgeted bound, before a forged small size can inflate a bomb.
      let expanded = compressed
      if (method === 8) {
        // Node's info result is not represented by the older convenience-method
        // type declaration. Validate its shape instead of trusting a cast.
        const info: unknown = inflateRawSync(compressed, {
          info: true,
          maxOutputLength: Math.max(1, Math.min(declaredSize, remaining, compressedSize * limits.maxRatio) + 1),
        })
        if (!info || typeof info !== 'object' || !('buffer' in info) || !Buffer.isBuffer(info.buffer)
          || !('engine' in info) || !info.engine || typeof info.engine !== 'object'
          || !('bytesWritten' in info.engine) || info.engine.bytesWritten !== compressedSize) return invalid()
        expanded = info.buffer
      }
      if (expanded.length !== declaredSize || expanded.length > remaining) return invalid()
      expandedTotal += expanded.length
    } catch { return invalid() }
    names.add(name)
    offset = next
  }
  return offset === end ? { ok: true, names } : invalid()
}
