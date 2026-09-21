'use client'
import { useId, useState } from 'react'

interface PrivacyRow { materialId: string; manifestId: string; createdAt: string; expiresAt: string; cleanup: 'retained' | 'pending' }
const date = (value: string) => new Intl.DateTimeFormat('hr-HR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
function isRow(value: unknown): value is PrivacyRow {
  if (!value || typeof value !== 'object') return false
  const row = value as PrivacyRow
  return typeof row.materialId === 'string' && typeof row.manifestId === 'string'
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && typeof row.expiresAt === 'string' && Number.isFinite(Date.parse(row.expiresAt))
    && ['retained', 'pending'].includes(row.cleanup)
}
export function MaterialPrivacy({ projectId }: { projectId: string }) {
  return <PrivacyPanel key={projectId} projectId={projectId} />
}
function PrivacyPanel({ projectId }: { projectId: string }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<PrivacyRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function load(after: string | null = null) {
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/materials/privacy?projectId=${encodeURIComponent(projectId)}${after ? `&after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !Array.isArray(body.materials) || body.materials.length > 100 || !body.materials.every(isRow)) throw new Error('metadata_unavailable')
      setRows(previous => after ? [...previous, ...body.materials.filter((row: PrivacyRow) => !previous.some(item => item.manifestId === row.manifestId))] : body.materials)
      setNextCursor(typeof body.nextCursor === 'string' ? body.nextCursor : null)
    } catch { setMessage('Pregled privremene pohrane nije dostupan. Pokušaj ponovno.') }
    finally { setBusy(false) }
  }
  async function withdraw(row: PrivacyRow) {
    if (busy || (row.cleanup !== 'pending' && !window.confirm('Povući pristanak i obrisati ovaj privremeni materijal? Ako ga koristi tijek, zaustavit će se i zatražit će se brisanje njegovih privremenih kopija. Lokalni rukopis ostaje sačuvan.'))) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(row.materialId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Povlačenje pristanka nije uspjelo.')
      if (body.cleanup === 'pending' && body.deletionRequested === row.materialId) {
        setRows(previous => previous.map(item => item.manifestId === row.manifestId ? { ...item, cleanup: 'pending' } : item))
        setMessage(body.runConsentRevoked ? 'Pristanak je povučen i povezani tijek zaustavljen; uklanjanje njegovih privremenih kopija još traje.' : 'Pristanak je povučen; uklanjanje datoteka još traje.')
      } else if (body.deleted === row.materialId) {
        setRows(previous => previous.filter(item => item.manifestId !== row.manifestId))
        setMessage(body.runConsentRevoked ? 'Povezani tijek je zaustavljen. Materijal i njegove privremene kopije u tom tijeku su obrisani.' : 'Materijal je obrisan.')
      } else throw new Error('Potvrda brisanja nije dostupna.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Potvrda brisanja nije dostupna.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Privatnost materijala">
    <button type="button" aria-expanded={open} aria-controls={panelId} disabled={busy} onClick={() => { setOpen(!open); if (!open) void load() }}>Privremeni materijali i brisanje</button>
    {open && <div id={panelId}>
      <p>Ovdje možeš povući pristanak i provjeriti uklanjanje privremenih materijala, i nakon isteka Passa.</p>
      {busy && <p>Provjeravam…</p>}
      {!busy && !rows.length && !message && <p>Nema preostalih privremenih materijala.</p>}
      <ul>{rows.map(row => <li key={row.manifestId}>
        <p>Materijal dodan {date(row.createdAt)} · rok uklanjanja {date(row.expiresAt)}</p>
        {row.cleanup === 'pending' && <p>Uklanjanje datoteka još traje.</p>}
        <button type="button" disabled={busy} onClick={() => void withdraw(row)}>{row.cleanup === 'pending' ? 'Provjeri brisanje' : 'Povuci pristanak'}</button>
      </li>)}</ul>
      {nextCursor && <button type="button" disabled={busy} onClick={() => void load(nextCursor)}>Učitaj još materijala</button>}
      <button type="button" disabled={busy} onClick={() => void load()}>Osvježi pregled</button>
      {message && <p role="status">{message}</p>}
    </div>}
  </section>
}
