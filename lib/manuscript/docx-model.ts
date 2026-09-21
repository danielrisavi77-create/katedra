import type { ManuscriptV1, TiptapNode } from './types'
import { isSafeManuscriptHref } from './links'

export type ExportRun = { text: string; bold: boolean; italic: boolean; link?: string }
export type ExportBlock = {
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'quote'
  level?: number
  runs: ExportRun[]
}
export type ManuscriptExportModel = {
  title: string
  meta: string[]
  sections: Array<{ title: string; blocks: ExportBlock[] }>
}

export function manuscriptToExportModel(manuscript: ManuscriptV1): ManuscriptExportModel {
  return {
    title: manuscript.title || 'Rad bez naslova',
    meta: [
      manuscript.meta.institution,
      manuscript.meta.mentor ? `Mentor: ${manuscript.meta.mentor}` : undefined,
      manuscript.meta.deadline ? `Rok: ${manuscript.meta.deadline}` : undefined,
    ].filter((value): value is string => Boolean(value)),
    sections: [...manuscript.sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => ({ title: section.title, blocks: nodesToBlocks(section.content.content || []) })),
  }
}

function nodesToBlocks(nodes: TiptapNode[], listType?: 'bullet' | 'numbered'): ExportBlock[] {
  const result: ExportBlock[] = []
  for (const node of nodes) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      result.push(...nodesToBlocks(node.content || [], node.type === 'bulletList' ? 'bullet' : 'numbered'))
      continue
    }
    if (node.type === 'listItem') {
      const paragraphs = node.content || []
      for (const paragraph of paragraphs) {
        result.push({ type: listType || 'bullet', runs: inlineRuns(paragraph.content || []) })
      }
      continue
    }
    if (node.type === 'heading') {
      result.push({ type: 'heading', level: Number(node.attrs?.level || 2), runs: inlineRuns(node.content || []) })
      continue
    }
    if (node.type === 'blockquote') {
      for (const paragraph of node.content || []) result.push({ type: 'quote', runs: inlineRuns(paragraph.content || []) })
      continue
    }
    if (node.type === 'paragraph') result.push({ type: 'paragraph', runs: inlineRuns(node.content || []) })
  }
  return result
}

function inlineRuns(nodes: TiptapNode[]): ExportRun[] {
  return nodes.flatMap((node) => {
    if (typeof node.text !== 'string') return inlineRuns(node.content || [])
    const link = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href
    return [{
      text: node.text,
      bold: Boolean(node.marks?.some((mark) => mark.type === 'bold')),
      italic: Boolean(node.marks?.some((mark) => mark.type === 'italic')),
    ...(isSafeManuscriptHref(link) ? { link } : {}),
    }]
  })
}
