'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'

import { isSafeManuscriptHref } from '../../../lib/manuscript/links'
import { countDocumentWords } from '../../../lib/manuscript/model'
import type { ManuscriptSectionV1, TiptapNode } from '../../../lib/manuscript/types'

export type EditorSelection = { from: number; to: number; text: string }
export type EditorApplyRequest = { id: string; sectionId: string; mode: 'replace' | 'append'; text: string; from?: number; to?: number }

export function ManuscriptEditor({
  section,
  acceptedFlash,
  onChange,
  onSelectionChange,
  applyRequest,
  onApplied,
}: {
  section: ManuscriptSectionV1
  acceptedFlash?: boolean
  onChange: (content: TiptapNode) => void
  onSelectionChange: (selection: EditorSelection | null) => void
  applyRequest?: EditorApplyRequest | null
  onApplied?: (content: TiptapNode) => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: (url) => isSafeManuscriptHref(url),
      }),
    ],
    content: section.content,
    editorProps: {
      attributes: {
        class: 'pis-prosemirror',
        'aria-label': `Tekst sekcije ${section.title}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getJSON() as TiptapNode),
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection
      if (from === to) return onSelectionChange(null)
      onSelectionChange({ from, to, text: currentEditor.state.doc.textBetween(from, to, ' ') })
    },
  }, [section.id])

  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const incoming = JSON.stringify(section.content)
    if (current !== incoming) editor.commands.setContent(section.content, { emitUpdate: false })
  }, [editor, section.content])

  useEffect(() => {
    if (!editor || !applyRequest || applyRequest.sectionId !== section.id) return
    const paragraphs = applyRequest.text.split(/\n{2,}/).filter(Boolean).map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    }))
    if (applyRequest.mode === 'replace' && applyRequest.from != null && applyRequest.to != null) {
      editor.chain().focus().insertContentAt({ from: applyRequest.from, to: applyRequest.to }, paragraphs).run()
    } else if (applyRequest.mode === 'append') {
      editor.chain().focus('end').insertContent(paragraphs).run()
    } else {
      return
    }
    onApplied?.(editor.getJSON() as TiptapNode)
  }, [applyRequest, editor, onApplied, section.id])

  if (!editor) return <div className="pis-editor-loading">Otvaram rukopis…</div>

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Poveznica', previous || 'https://')
    if (href === null) return
    if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else if (isSafeManuscriptHref(href)) editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
    else window.alert('Unesi poveznicu koja počinje s http://, https:// ili mailto:.')
  }

  return (
    <article className={`pis-paper${acceptedFlash ? ' is-accepted' : ''}`}>
      <div className="pis-section-heading">
        <p>Aktivna sekcija</p>
        <h1>{section.title}</h1>
        <span>{countDocumentWords(section.content).toLocaleString('hr-HR')} riječi</span>
      </div>
      <div className="pis-formatbar" aria-label="Oblikovanje teksta">
        <button type="button" title="Poništi" onClick={() => editor.chain().focus().undo().run()}>↶</button>
        <button type="button" title="Ponovi" onClick={() => editor.chain().focus().redo().run()}>↷</button>
        <i />
        <button type="button" className={editor.isActive('bold') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" className={editor.isActive('italic') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
        <button type="button" className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" className={editor.isActive('bulletList') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Lista</button>
        <button type="button" className={editor.isActive('orderedList') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Lista</button>
        <button type="button" className={editor.isActive('blockquote') ? 'is-active' : ''} onClick={() => editor.chain().focus().toggleBlockquote().run()}>„ Citat</button>
        <button type="button" className={editor.isActive('link') ? 'is-active' : ''} onClick={setLink}>↗ Link</button>
      </div>
      <EditorContent editor={editor} />
      <footer className="pis-paper-footer">
        <span>{section.status === 'approved' ? 'Odobreno' : section.status === 'review' ? 'Za pregled' : section.status === 'draft' ? 'Radna verzija' : 'Prazna sekcija'}</span>
        <span>Rukopis ostaje na ovom uređaju</span>
      </footer>
    </article>
  )
}
