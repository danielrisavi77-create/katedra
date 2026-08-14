'use client'

import { useEffect, useState } from 'react'

type MaterialStatus = 'pending' | 'processing' | 'extracted' | 'partial' | 'failed' | 'needs_review'
type Material = { id: string; name: string; kind: string; extractionStatus: MaterialStatus; warnings?: string[]; expiresAt?: string }

export function MaterialLibrary({ projectId, onUploaded, onMaterialsChange }: { projectId: string; onUploaded?: (material: Material) => void; onMaterialsChange?: (materials: Material[]) => void }) {
  const [kind, setKind] = useState('notes')
  const [materials, setMaterials] = useState<Material[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const response = await fetch(`/api/materials?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null)
      if (!response?.ok) return
      const body = await response.json().catch(() => ({}))
      const loaded = Array.isArray(body.materials) ? body.materials as Material[] : []
      if (!cancelled) {
        setMaterials(loaded)
        onMaterialsChange?.(loaded)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [onMaterialsChange, projectId])

  const upload = async (file: File) => {
    setBusy(true); setMessage('')
    const form = new FormData()
    form.set('projectId', projectId); form.set('kind', kind); form.set('file', file)
    try {
      const response = await fetch('/api/materials', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Materijal nije moguće učitati.')
      const material = body.asset as Material
      setMaterials((current) => {
        const next = [...current, material]
        onMaterialsChange?.(next)
        return next
      })
      onUploaded?.(material)
      setMessage(material.extractionStatus === 'needs_review' ? 'Materijal je spremljen, ali treba ručni pregled.' : 'Materijal je učitan i analiziran.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload nije uspio.')
    } finally { setBusy(false) }
  }

  return <section className="pis-material-library" aria-labelledby="pis-material-title">
    <div className="pis-agent-section-heading"><div><p className="pis-kicker">Ulazni materijali</p><h3 id="pis-material-title">Daj agentima kontekst.</h3></div><span>{materials.length} učitano</span></div>
    <p className="pis-agent-copy">Dodaj postojeći rad, literaturu, mentorove upute ili pravila fakulteta. Materijali su privremeni i privatni; rukopis ostaje lokalno spremljen.</p>
    <div className="pis-material-upload"><select aria-label="Vrsta materijala" value={kind} onChange={(event) => setKind(event.target.value)}><option value="draft">Moj postojeći rad</option><option value="source">Literatura</option><option value="mentor">Mentorove upute</option><option value="rules">Pravila fakulteta</option><option value="notes">Bilješke</option><option value="scan">Sken ili slika</option></select><label className="pis-file-button">{busy ? 'Analiziram…' : 'Dodaj datoteku'}<input type="file" accept=".docx,.pdf,.txt,.md,image/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} /></label></div>
    {message && <p className="pis-agent-message" role="status">{message}</p>}
    {materials.length > 0 && <ul className="pis-material-list">{materials.map((material) => <li key={material.id}><span className={`pis-status-dot is-${material.extractionStatus}`} /><div><b>{material.name}</b><small>{materialStatus(material.extractionStatus)}</small></div></li>)}</ul>}
  </section>
}

function materialStatus(status: MaterialStatus) {
  return ({ extracted: 'Tekst je izvučen', partial: 'Djelomično izvučeno', needs_review: 'Čeka pregled', failed: 'Nije obrađeno', processing: 'Obrada u tijeku', pending: 'Čeka obradu' } as Record<MaterialStatus, string>)[status]
}
