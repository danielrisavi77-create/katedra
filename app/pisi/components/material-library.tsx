'use client'

import { useCallback, useEffect, useState } from 'react'

import type { MaterialAssetV1, MaterialExtractionStatus, MaterialKind } from '../../../lib/materials/types'

const MATERIAL_KINDS: Array<{ value: MaterialKind; label: string }> = [
  { value: 'draft', label: 'Moj postojeći rad' },
  { value: 'source', label: 'Literatura' },
  { value: 'mentor', label: 'Mentorove upute' },
  { value: 'rules', label: 'Pravila fakulteta' },
  { value: 'notes', label: 'Bilješke' },
  { value: 'scan', label: 'Sken ili slika' },
]

export function MaterialLibrary({ projectId, onUploaded, onMaterialsChange }: { projectId: string; onUploaded?: (material: MaterialAssetV1) => void; onMaterialsChange?: (materials: MaterialAssetV1[]) => void }) {
  const [kind, setKind] = useState<MaterialKind>('notes')
  const [materials, setMaterials] = useState<MaterialAssetV1[]>([])
  const [busy, setBusy] = useState(false)
  const [refreshingId, setRefreshingId] = useState('')
  const [message, setMessage] = useState('')

  const publish = useCallback((next: MaterialAssetV1[]) => {
    setMaterials(next)
    onMaterialsChange?.(next)
  }, [onMaterialsChange])

  const loadMaterials = useCallback(async (): Promise<MaterialAssetV1[]> => {
    const response = await fetch(`/api/materials?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).catch(() => null)
    if (!response) {
      setMessage('Materijale trenutačno nije moguće učitati.')
      return []
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      setMessage(materialRequestMessage(response.status, body.error, 'Materijale trenutačno nije moguće učitati.'))
      return []
    }
    const loaded = Array.isArray(body.materials) ? body.materials as MaterialAssetV1[] : []
    publish(loaded)
    return loaded
  }, [projectId, publish])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMaterials() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMaterials])

  const upload = async (file: File) => {
    setBusy(true)
    setMessage('')
    const form = new FormData()
    form.set('projectId', projectId)
    form.set('kind', kind)
    form.set('file', file)
    try {
      const response = await fetch('/api/materials', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      const asset = isMaterial(body.asset) ? body.asset : null
      if (!response.ok) {
        if (asset) publish([...materials, asset])
        throw new Error(materialRequestMessage(response.status, body.error, 'Materijal nije moguće učitati.'))
      }
      if (!asset) throw new Error('Upload nije vratio valjan status materijala.')
      publish([...materials, asset])
      onUploaded?.(asset)
      setMessage(asset.extractionStatus === 'needs_review' || asset.extractionStatus === 'partial'
        ? 'Materijal je spremljen, ali treba ručni pregled.'
        : 'Materijal je učitan i pročitan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload nije uspio.')
    } finally {
      setBusy(false)
    }
  }

  const retry = async (materialId: string) => {
    setRefreshingId(materialId)
    setMessage('Ponovno provjeravam status materijala…')
    const refreshed = await loadMaterials()
    const material = refreshed.find((item) => item.id === materialId)
    setMessage(material?.extractionStatus === 'failed'
      ? 'Materijal i dalje nije moguće pročitati. Pokušaj ga ponovno dodati u drugom formatu.'
      : 'Status materijala je osvježen.')
    setRefreshingId('')
  }

  return <section className="pis-material-library" aria-labelledby="pis-material-title">
    <div className="pis-agent-section-heading"><div><p className="pis-kicker">Ulazni materijali</p><h3 id="pis-material-title">Dodaj kontekst za rad.</h3></div><span>{materials.length} učitano</span></div>
    <p className="pis-agent-copy">Dodaj postojeći rad, literaturu, mentorove upute ili pravila fakulteta. Materijali su privremeni i privatni; rukopis ostaje lokalno spremljen.</p>
    <div className="pis-material-upload"><select aria-label="Vrsta materijala" value={kind} onChange={(event) => setKind(event.target.value as MaterialKind)}>{MATERIAL_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><label className="pis-file-button">{busy ? 'Čitamo…' : 'Dodaj datoteku'}<input type="file" accept=".docx,.pdf,.txt,.md,image/*" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} /></label></div>
    {message && <p className="pis-agent-message" role="status">{message}</p>}
    {materials.length > 0 && <ul className="pis-material-list">{materials.map((material) => <li key={material.id} data-status={material.extractionStatus}><span className={`pis-status-dot is-${material.extractionStatus}`} aria-hidden="true" /><div><b title={material.name}>{material.name}</b><small>{materialStatus(material.extractionStatus)}</small></div>{material.extractionStatus === 'failed' && <button type="button" onClick={() => void retry(material.id)} disabled={refreshingId === material.id} aria-label="Pokušaj ponovno">{refreshingId === material.id ? 'Provjeravam…' : 'Pokušaj ponovno'}</button>}</li>)}</ul>}
  </section>
}

export function materialStatus(status: MaterialExtractionStatus): string {
  return ({
    extracted: 'Pročitano',
    partial: 'Potrebna provjera',
    needs_review: 'Potrebna provjera',
    failed: 'Nije moguće pročitati',
    processing: 'Čitamo',
    pending: 'Čeka čitanje',
  } as Record<MaterialExtractionStatus, string>)[status]
}

function isMaterial(value: unknown): value is MaterialAssetV1 {
  if (!value || typeof value !== 'object') return false
  const material = value as Partial<MaterialAssetV1>
  return typeof material.id === 'string' && typeof material.name === 'string' && typeof material.extractionStatus === 'string'
}

function materialRequestMessage(status: number, detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  return ({
    401: 'Prijavi se kako bi dodao materijale.',
    402: 'Aktiviraj Pass za ovaj projekt kako bi dodao materijale.',
    403: 'Materijali nisu dostupni za ovaj projekt ili račun.',
    429: 'Previše uploadova u kratkom vremenu. Pričekaj trenutak pa pokušaj ponovno.',
    503: 'Pohrana materijala trenutačno nije dostupna. Pokušaj kasnije.',
  } as Record<number, string>)[status] || fallback
}
