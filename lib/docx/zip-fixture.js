// Test-only, real ZIP container builder. No documents are written to disk.
import { crc32, deflateRawSync } from 'node:zlib'

export function zipFixture(entries = [
  { name: '[Content_Types].xml', text: '<Types />' },
  { name: 'word/document.xml', text: '<document />' },
]) {
  const local = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name)
    const extra = entry.extra || Buffer.alloc(0)
    const raw = Buffer.from(entry.text || '')
    const method = entry.stored ? 0 : 8
    const data = Buffer.concat([method === 0 ? raw : deflateRawSync(raw), entry.compressedTail || Buffer.alloc(0)])
    const flags = entry.encrypted ? 1 : 0
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(flags, 6)
    header.writeUInt16LE(method, 8)
    header.writeUInt32LE(crc32(raw), 14)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(entry.declaredSize ?? raw.length, 22)
    header.writeUInt16LE(name.length, 26)
    header.writeUInt16LE(extra.length, 28)
    local.push(header, name, extra, data)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0)
    directory.writeUInt16LE(20, 4)
    directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(flags, 8)
    directory.writeUInt16LE(method, 10)
    directory.writeUInt32LE(crc32(raw), 16)
    directory.writeUInt32LE(data.length, 20)
    directory.writeUInt32LE(entry.declaredSize ?? raw.length, 24)
    directory.writeUInt16LE(name.length, 28)
    directory.writeUInt16LE(extra.length, 30)
    directory.writeUInt32LE(offset, 42)
    central.push(directory, name, extra)
    offset += header.length + name.length + extra.length + data.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}
