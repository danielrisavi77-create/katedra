import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

import { manuscriptToExportModel, type ExportBlock, type ExportRun } from './docx-model'
import type { ManuscriptV1 } from './types'

export async function exportManuscriptDocx(manuscript: ManuscriptV1): Promise<void> {
  const model = manuscriptToExportModel(manuscript)
  const document = new Document({
    creator: 'Katedra',
    title: model.title,
    description: 'Radni DOCX izvezen iz Katedrine radionice rukopisa.',
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: model.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
        ...model.meta.map((line) => new Paragraph({ text: line, alignment: AlignmentType.CENTER })),
        new Paragraph({ text: '', pageBreakBefore: true }),
        ...model.sections.flatMap((section) => [
          new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: section !== model.sections[0] }),
          ...section.blocks.map(blockToParagraph),
        ]),
      ],
    }],
  })
  const blob = await Packer.toBlob(document)
  const anchor = window.document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = `${safeFilename(model.title)}-${new Date().toISOString().slice(0, 10)}.docx`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

function blockToParagraph(block: ExportBlock): Paragraph {
  return new Paragraph({
    children: block.runs.flatMap(runToChildren),
    heading: block.type === 'heading'
      ? block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2
      : undefined,
    bullet: block.type === 'bullet' ? { level: 0 } : undefined,
    numbering: block.type === 'numbered' ? { reference: 'default-numbering', level: 0 } : undefined,
    indent: block.type === 'quote' ? { left: 720 } : undefined,
    spacing: { after: 160, line: 360 },
  })
}

function runToChildren(run: ExportRun): Array<TextRun | ExternalHyperlink> {
  const text = new TextRun({ text: run.text, bold: run.bold, italics: run.italic })
  return run.link ? [new ExternalHyperlink({ link: run.link, children: [text] })] : [text]
}

function safeFilename(title: string): string {
  return title.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'katedra-rad'
}
