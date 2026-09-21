// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AgenticProcessPreview } from './agentic-process-preview'

afterEach(cleanup)

describe('AgenticProcessPreview', () => {
  it('shows the complete process without pretending that a run is active', () => {
    render(<AgenticProcessPreview mode="autonomous" sourcePolicy="web_research" />)

    expect(screen.getByRole('heading', { name: 'Kako nastaje tvoj rad' })).toBeTruthy()
    expect(screen.getByText('Priprema i analiza materijala')).toBeTruthy()
    expect(screen.getByText('Istraživanje i provjera izvora')).toBeTruthy()
    expect(screen.getByText('Pisanje poglavlja')).toBeTruthy()
    expect(screen.getByText('Pregled i Quality Gate')).toBeTruthy()
    expect(screen.getByText('Pregled prije pokretanja')).toBeTruthy()
    expect(screen.queryByText(/Pokušaj 1\/3/)).toBeNull()
  })

  it('explains the selected mode and source policy', () => {
    render(<AgenticProcessPreview mode="guided" sourcePolicy="uploaded_only" />)

    expect(screen.getByText(/Vođeno/)).toBeTruthy()
    expect(screen.getByText(/Samo tvoji materijali/)).toBeTruthy()
    expect(screen.getByText(/Svaki rezultat prolazi zasebnu provjeru/)).toBeTruthy()
  })

  it('keeps internal agent names behind expandable technical details', () => {
    render(<AgenticProcessPreview mode="guided" sourcePolicy="uploaded_only" />)

    expect(screen.queryByText('Intake agent')).toBeNull()
    expect(screen.queryByText('Sources agent')).toBeNull()
    expect(screen.getAllByText('Tehnički detalji')).toHaveLength(5)
  })
})
