import mammoth from 'mammoth'

import { DOCX_LIMITS, validateDocxBuffer } from '../docx/validation'
import type { OcrProvider } from './types'

export const MATERIAL_LIMITS = {
  maxBytes: DOCX_LIMITS.maxBytes,
  maxTextChars: 250_000,
  maxPdfPages: 200,
  timeoutMs: 20_000,
} as const

export interface MaterialInput {
  name: string
  mimeType: string
  buffer: Buffer
}

export interface MaterialExtractionResult {
  status: 'extracted' | 'partial' | 'failed' | 'needs_review'
  text: string
  pageCount?: number
  warnings: string[]
}

export async function extractMaterial(input: MaterialInput, options: { ocr?: OcrProvider } = {}): Promise<MaterialExtractionResult> {
  if (!Buffer.isBuffer(input.buffer) || input.buffer.length > MATERIAL_LIMITS.maxBytes) {
    return failed('Datoteka je prevelika ili nije valjan binarni sadržaj.')
  }

  const extension = input.name.toLowerCase().split('.').pop()
  try {
    if (!isMimeCompatible(extension, input.mimeType)) return failed('MIME tip i ekstenzija materijala nisu usklađeni.')
    const signatureError = validateBinarySignature(extension, input.buffer)
    if (signatureError) return failed(signatureError)
    if (extension === 'txt' || extension === 'md') return normalizeText(input.buffer.toString('utf8'))
    if (extension === 'docx') return await withTimeout(extractDocx(input), MATERIAL_LIMITS.timeoutMs)
    if (extension === 'pdf') return await withTimeout(extractPdf(input), MATERIAL_LIMITS.timeoutMs)
    if (input.mimeType.startsWith('image/')) {
      if (!options.ocr) return { status: 'needs_review', text: '', warnings: ['OCR provider nije konfiguriran.'] }
      const result = await withTimeout(options.ocr(input), MATERIAL_LIMITS.timeoutMs)
      return normalizeOcr(result.text, result.warnings)
    }
  } catch (error) {
    return failed(safeExtractionError(error))
  }

  return failed('Format materijala nije podržan.')
}

function isMimeCompatible(extension: string | undefined, mimeType: string): boolean {
  const type = mimeType.trim().toLowerCase()
  if (!type) return true
  if (extension === 'txt') return type === 'text/plain'
  if (extension === 'md') return type === 'text/markdown' || type === 'text/plain'
  if (extension === 'docx') return type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || type === 'application/zip'
  if (extension === 'pdf') return type === 'application/pdf'
  const imageMimeTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff',
  }
  return imageMimeTypes[extension || ''] === type
}

function validateBinarySignature(extension: string | undefined, buffer: Buffer): string | null {
  if (extension === 'pdf' && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return 'Datoteka nema valjan PDF potpis.'
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff'].includes(extension || '') && !hasImageSignature(extension, buffer)) {
    return `Datoteka nema valjan ${String(extension).toUpperCase()} potpis.`
  }
  return null
}

function hasImageSignature(extension: string | undefined, buffer: Buffer): boolean {
  if (extension === 'png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (extension === 'jpg' || extension === 'jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (extension === 'gif') return buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  if (extension === 'webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (extension === 'tif' || extension === 'tiff') return buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  return false
}

async function extractDocx(input: MaterialInput): Promise<MaterialExtractionResult> {
  const validation = validateDocxBuffer(input.buffer, { name: input.name, type: input.mimeType })
  if (!validation.ok) return failed(validation.error)
  const result = await mammoth.extractRawText({ buffer: input.buffer })
  return normalizeText(result.value, result.messages.map((message) => message.message))
}

async function extractPdf(input: MaterialInput): Promise<MaterialExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const document = await pdfjs.getDocument({ data: new Uint8Array(input.buffer), useWorkerFetch: false, isEvalSupported: false }).promise
  try {
    if (document.numPages > MATERIAL_LIMITS.maxPdfPages) return failed('PDF ima previše stranica.')
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '))
    }
    const result = normalizeText(pages.join('\n\n'))
    return { ...result, pageCount: document.numPages }
  } finally {
    await document.destroy()
  }
}

function normalizeOcr(text: string, warnings: string[]): MaterialExtractionResult {
  const normalized = normalizeText(text, warnings)
  return normalized.text ? normalized : { ...normalized, status: 'needs_review' }
}

function normalizeText(text: string, warnings: string[] = []): MaterialExtractionResult {
  const trimmed = text.trim()
  if (!trimmed) return { status: 'needs_review', text: '', warnings: [...warnings, 'Dokument nema prepoznat tekst.'] }
  const truncated = trimmed.length > MATERIAL_LIMITS.maxTextChars
  const truncationMarker = '\n\n[tekst skraćen zbog ograničenja]'
  return {
    status: truncated ? 'partial' : warnings.length ? 'partial' : 'extracted',
    text: truncated ? `${trimmed.slice(0, MATERIAL_LIMITS.maxTextChars - truncationMarker.length)}${truncationMarker}` : trimmed,
    warnings: truncated ? [...warnings, 'Tekst je skraćen zbog ograničenja veličine.'] : warnings,
  }
}

function failed(message: string): MaterialExtractionResult {
  return { status: 'failed', text: '', warnings: [message] }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Ekstrakcija materijala traje predugo.')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function safeExtractionError(error: unknown): string {
  if (error instanceof Error && error.message === 'Ekstrakcija materijala traje predugo.') {
    return error.message
  }
  return 'Ekstrakcija materijala nije uspjela.'
}
