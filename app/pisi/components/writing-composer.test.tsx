// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WritingComposer } from './writing-composer'

afterEach(cleanup)

describe('WritingComposer', () => {
  it('sends a question for the active section', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(<WritingComposer sectionTitle="Uvod" onRun={onRun} />)

    await user.type(screen.getByRole('textbox', { name: 'Pitaj Katedru' }), 'Pomozi mi razjasniti tezu.')
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(onRun).toHaveBeenCalledWith('question', 'Pomozi mi razjasniti tezu.')
  })

  it('sends the selected request type instead of treating every command as improve', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(<WritingComposer sectionTitle="Uvod" onRun={onRun} />)

    await user.selectOptions(screen.getByLabelText('Vrsta zahtjeva'), 'draft')
    await user.type(screen.getByRole('textbox', { name: 'Pitaj Katedru' }), 'Napiši početni nacrt.')
    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(onRun).toHaveBeenCalledWith('draft', 'Napiši početni nacrt.')
  })

  it('resets selection-only actions when the editor selection disappears', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    const view = render(<WritingComposer sectionTitle="Uvod" selectionText="selected text" onRun={onRun} />)

    await user.selectOptions(screen.getByLabelText('Vrsta zahtjeva'), 'expand')
    view.rerender(<WritingComposer sectionTitle="Uvod" onRun={onRun} />)
    await user.type(screen.getByRole('textbox', { name: 'Pitaj Katedru' }), 'Explain the next step.')
    await user.click(screen.getByRole('button'))

    expect(onRun).toHaveBeenCalledWith('question', 'Explain the next step.')
  })

  it('uploads a supported material through the compact plus control', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue(undefined)
    render(<WritingComposer sectionTitle="Uvod" onRun={vi.fn()} onUpload={onUpload} />)

    const file = new File(['naslov'], 'upute.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Dodaj materijal u chat'), file)

    expect(onUpload).toHaveBeenCalledWith(file)
    expect(await screen.findByText('upute.pdf')).toBeTruthy()
  })

  it('uploads every file selected through the multiple-file control', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue(undefined)
    render(<WritingComposer sectionTitle="Uvod" onRun={vi.fn()} onUpload={onUpload} />)

    const files = [
      new File(['upute'], 'upute.txt', { type: 'text/plain' }),
      new File(['biljeske'], 'biljeske.md', { type: 'text/markdown' }),
    ]
    await user.upload(screen.getByLabelText('Dodaj materijal u chat'), files)

    expect(onUpload).toHaveBeenNthCalledWith(1, files[0])
    expect(onUpload).toHaveBeenNthCalledWith(2, files[1])
    expect(await screen.findByText('upute.txt')).toBeTruthy()
    expect(await screen.findByText('biljeske.md')).toBeTruthy()
  })

  it('shows an honest limitation returned for a non-text attachment', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn().mockResolvedValue({ warnings: ['Slika još nije dostupna tekstualnom razgovoru.'] })
    render(<WritingComposer sectionTitle="Uvod" onRun={vi.fn()} onUpload={onUpload} />)

    await user.upload(screen.getByLabelText('Dodaj materijal u chat'), new File(['image'], 'graf.png', { type: 'image/png' }))

    expect(await screen.findByText('Slika još nije dostupna tekstualnom razgovoru.')).toBeTruthy()
  })

  it('restores persisted materials and lets the user remove one', async () => {
    const user = userEvent.setup()
    const onRemoveUpload = vi.fn()
    render(<WritingComposer sectionTitle="Uvod" onRun={vi.fn()} materials={[{ name: 'upute.txt', text: 'tekst', warnings: [] }]} onRemoveUpload={onRemoveUpload} />)

    expect(screen.getByText('upute.txt')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Ukloni materijal upute.txt' }))

    expect(onRemoveUpload).toHaveBeenCalledWith('upute.txt')
    expect(screen.queryByText('upute.txt')).toBeNull()
  })
})
