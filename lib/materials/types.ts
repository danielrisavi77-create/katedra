export type MaterialKind = 'draft' | 'source' | 'mentor' | 'rules' | 'notes' | 'scan'
export type MaterialExtractionStatus = 'pending' | 'processing' | 'extracted' | 'partial' | 'failed' | 'needs_review'

export interface MaterialAssetV1 {
  id: string
  projectId: string
  name: string
  kind: MaterialKind
  mimeType: string
  extractionStatus: MaterialExtractionStatus
  extractedText?: string
  pageCount?: number
  warnings: string[]
  expiresAt: string
}

export interface OcrResult {
  text: string
  warnings: string[]
}

export type OcrProvider = (input: { name: string; mimeType: string; buffer: Buffer }) => Promise<OcrResult>
