import { extractMaterial, type MaterialExtractionResult, type MaterialInput } from './extractors'
import type { MaterialAssetV1, MaterialKind, OcrProvider } from './types'

export const DEFAULT_MATERIAL_TTL_MS = 72 * 60 * 60 * 1000
export const MAX_MATERIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface MaterialProvider {
  extract(input: MaterialInput & { id: string; projectId: string; kind: MaterialKind }): Promise<MaterialAssetV1>
}

export function createMaterialProvider({
  now = () => Date.now(),
  ocr,
  ttlMs = DEFAULT_MATERIAL_TTL_MS,
}: {
  now?: () => number
  ocr?: OcrProvider
  ttlMs?: number
} = {}): MaterialProvider {
  return {
    async extract(input) {
      const result = await extractMaterial(input, { ocr })
      return toAsset(input, result, now(), ttlMs)
    },
  }
}

export function createMaterialAsset(
  input: Omit<MaterialAssetV1, 'extractionStatus' | 'warnings' | 'expiresAt'>,
  now = Date.now(),
  ttlMs = DEFAULT_MATERIAL_TTL_MS,
): MaterialAssetV1 {
  return {
    ...input,
    extractionStatus: 'pending',
    warnings: [],
    expiresAt: new Date(now + Math.min(Math.max(0, ttlMs), MAX_MATERIAL_TTL_MS)).toISOString(),
  }
}

function toAsset(
  input: MaterialInput & { id: string; projectId: string; kind: MaterialKind },
  result: MaterialExtractionResult,
  now: number,
  ttlMs: number,
): MaterialAssetV1 {
  const asset = createMaterialAsset({
    id: input.id,
    projectId: input.projectId,
    name: input.name,
    kind: input.kind,
    mimeType: input.mimeType,
  }, now, ttlMs)
  return {
    ...asset,
    extractionStatus: result.status,
    extractedText: result.text || undefined,
    pageCount: result.pageCount,
    warnings: result.warnings,
  }
}
