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
    if (extension === 'txt' || extension === 'md') return normalizeText(input.buffer.toString('utf8'))
    if (extension === 'docx') return await withTimeout(extractDocx(input), MATERIAL_LIMITS.timeoutMs)
    if (extension === 'pdf') return await withTimeout(extractPdf(input), MATERIAL_LIMITS.timeoutMs)
    if (input.mimeType.startsWith('image/')) {
      if (!options.ocr) return { status: 'needs_review', text: '', warnings: ['OCR provider nije konfiguriran.'] }
      const result = await withTimeout(options.ocr(input), MATERIAL_LIMITS.timeoutMs)
      return normalizeOcr(result.text, result.warnings)
    }
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Ekstrakcija materijala nije uspjela.')
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
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff'].includes(extension || '')) return type.startsWith('image/')
  return true
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
  return {
    status: truncated ? 'partial' : warnings.length ? 'partial' : 'extracted',
    text: truncated ? `${trimmed.slice(0, MATERIAL_LIMITS.maxTextChars)}\n\n[tekst skraćen zbog ograničenja]` : trimmed,
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
