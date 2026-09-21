// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { ManuscriptSectionV1, TiptapNode } from '../../../lib/manuscript/types'

const mocks = vi.hoisted(() => ({ editor: null as unknown }))
vi.mock('@tiptap/react', () => ({ useEditor: () => mocks.editor, EditorContent: () => <div /> }))

import { ManuscriptEditor, type EditorApplyRequest } from './manuscript-editor'

const original: TiptapNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original text' }] }] }
const edited: TiptapNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New user text' }] }] }
const section: ManuscriptSectionV1 = {
  id: 'intro', title: 'Intro', kind: 'chapter', order: 0, status: 'draft', content: original, updatedAt: '2026-09-07T12:00:00Z',
}
const applyRequest: EditorApplyRequest = {
  id: 'proposal-1', sectionId: 'intro', mode: 'append', text: 'Proposed text', expectedContent: original,
}

let content: TiptapNode
let insert: ReturnType<typeof vi.fn>
let run: ReturnType<typeof vi.fn>
const schema = getSchema([StarterKit.configure({ link: false }), Link])

beforeEach(() => {
  content = original
  run = vi.fn(() => true)
  const chain = { focus: () => chain, insertContent: vi.fn(() => chain), insertContentAt: vi.fn(() => chain), run }
  insert = chain.insertContent
  mocks.editor = {
    schema,
    get state() { return { doc: schema.nodeFromJSON(content) } },
    getJSON: () => schema.nodeFromJSON(content).toJSON(), commands: { setContent: (value: TiptapNode) => { content = value } },
    chain: () => chain, isActive: () => false,
  }
})
afterEach(cleanup)

describe('manuscript editor proposal commit boundary', () => {
  it('does not issue commands on the destroyed editor during a section transition', () => {
    const editor = mocks.editor as Record<string, unknown>
    editor.isDestroyed = true
    const commands = vi.fn(() => { throw new Error('destroyed command manager') })
    Object.defineProperty(editor, 'commands', { get: commands })
    expect(() => render(<ManuscriptEditor section={{ ...section, content: edited }} onChange={vi.fn()} onSelectionChange={vi.fn()} />)).not.toThrow()
    expect(commands).not.toHaveBeenCalled()
  })

  it('accepts unchanged restored links after actual Tiptap schema normalization', () => {
    const linked: TiptapNode = { type: 'doc', content: [{ type: 'paragraph', content: [{
      type: 'text', text: 'Source', marks: [{ type: 'link', attrs: { href: 'https://example.test' } }],
    }] }] }
    content = linked
    const onApplied = vi.fn()
    render(<ManuscriptEditor section={{ ...section, content: linked }} applyRequest={{ ...applyRequest, expectedContent: linked }} onChange={vi.fn()} onSelectionChange={vi.fn()} onApplied={onApplied} />)
    expect(JSON.stringify(schema.nodeFromJSON(linked).toJSON())).not.toBe(JSON.stringify(linked))
    expect(insert).toHaveBeenCalledOnce()
    expect(onApplied).toHaveBeenCalledOnce()
  })

  it('rejects a request based on content changed while the snapshot was pending', () => {
    const onApplied = vi.fn()
    const onApplyRejected = vi.fn()
    const props = { onChange: vi.fn(), onSelectionChange: vi.fn(), onApplied, onApplyRejected }
    const view = render(<ManuscriptEditor section={section} {...props} />)
    view.rerender(<ManuscriptEditor section={{ ...section, content: edited }} {...props} />)
    view.rerender(<ManuscriptEditor section={{ ...section, content: edited }} applyRequest={applyRequest} {...props} />)
    expect(insert).not.toHaveBeenCalled()
    expect(onApplied).not.toHaveBeenCalled()
    expect(onApplyRejected).toHaveBeenCalledOnce()
    expect(content).toEqual(edited)
  })

  it('does not apply the same request twice when callbacks change before the parent clears it', () => {
    const onApplied = vi.fn()
    const props = { section, applyRequest, onChange: vi.fn(), onSelectionChange: vi.fn(), onApplied }
    const view = render(<ManuscriptEditor {...props} />)
    view.rerender(<ManuscriptEditor {...props} onApplied={vi.fn()} />)
    expect(insert).toHaveBeenCalledOnce()
    expect(onApplied).toHaveBeenCalledOnce()
  })

  it('does not record acceptance when the editor refuses the command', () => {
    run.mockReturnValue(false)
    const onApplied = vi.fn()
    const onApplyRejected = vi.fn()
    render(<ManuscriptEditor section={section} applyRequest={applyRequest} onChange={vi.fn()} onSelectionChange={vi.fn()} onApplied={onApplied} onApplyRejected={onApplyRejected} />)
    expect(onApplied).not.toHaveBeenCalled()
    expect(onApplyRejected).toHaveBeenCalledOnce()
  })
})
