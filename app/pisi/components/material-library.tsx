'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { MaterialAssetV1, MaterialExtractionStatus, MaterialKind } from '../../../lib/materials/types'
import { MATERIAL_CONSENT_HEADER, MATERIAL_CONSENT_VERSION } from '../../../lib/materials/consent'

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
  const [reuploadId, setReuploadId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')
  const [consentProjectId, setConsentProjectId] = useState<string | null>(null)
  const consentAccepted = consentProjectId === projectId
  const reuploadInput = useRef<HTMLInputElement>(null)

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
    const loaded = Array.isArray(body.materials) ? body.materials.filter(isMaterial) : []
    publish(loaded)
    return loaded
  }, [projectId, publish])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMaterials() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMaterials])

  const upload = async (file: File, uploadKind = kind, replaceId = '') => {
    if (!consentAccepted) return
    setBusy(true)
    setMessage('')
    const form = new FormData()
    form.set('projectId', projectId)
    form.set('kind', uploadKind)
    form.set('file', file)
    try {
      const response = await fetch('/api/materials', { method: 'POST', headers: { [MATERIAL_CONSENT_HEADER]: MATERIAL_CONSENT_VERSION }, body: form }).catch(() => null)
      if (!response) throw new Error('Materijal trenutačno nije moguće učitati zbog mrežne greške. Pokušaj ponovno.')
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      const asset = isMaterial(body.asset) ? body.asset : null
      if (!response.ok) {
        if (asset) publish(replaceId ? replaceMaterial(materials, replaceId, asset) : [...materials, asset])
        throw new Error(materialRequestMessage(response.status, body.error, 'Materijal nije moguće učitati.'))
      }
      if (!asset) throw new Error('Upload nije vratio valjan status materijala.')
      publish(replaceId ? replaceMaterial(materials, replaceId, asset) : [...materials, asset])
      onUploaded?.(asset)
      setMessage(asset.extractionStatus === 'needs_review' || asset.extractionStatus === 'partial'
        ? 'Materijal je spremljen, ali treba ručni pregled.'
        : 'Materijal je učitan i pročitan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload nije uspio.')
    } finally {
      setBusy(false)
      setReuploadId('')
    }
  }

  const reupload = (material: MaterialAssetV1) => {
    setReuploadId(material.id)
    setMessage('Odaberi novu datoteku za ponovni pokušaj. Postojeći neuspjeli materijal neće se slati u tijek.')
    reuploadInput.current?.click()
  }

  const deleteMaterial = async (material: MaterialAssetV1) => {
    if (busy || !window.confirm(`Obrisati materijal „${material.name}”?`)) return
    setBusy(true)
    setDeletingId(material.id)
    setMessage('')
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(material.id)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' }).catch(() => null)
      if (!response) throw new Error('Materijal trenutačno nije moguće obrisati zbog mrežne greške. Pokušaj ponovno.')
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      if (!response.ok) throw new Error(materialRequestMessage(response.status, body.error, 'Materijal nije moguće obrisati.'))
      publish(materials.filter((item) => item.id !== material.id))
      setMessage('Materijal je obrisan.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Brisanje materijala nije uspjelo.')
    } finally {
      setBusy(false)
      setDeletingId('')
    }
  }

  return <section className="pis-material-library" aria-labelledby="pis-material-title">
    <div className="pis-agent-section-heading"><div><p className="pis-kicker">Ulazni materijali</p><h3 id="pis-material-title">Dodaj kontekst za rad.</h3></div><span>{materials.length} učitano</span></div>
    <p className="pis-agent-copy">Dodaj postojeći rad, literaturu, mentorove upute ili pravila fakulteta. Materijali su privremeni i privatni; rukopis ostaje lokalno spremljen.</p>
    <label><input type="checkbox" checked={consentAccepted} disabled={busy} onChange={(event) => setConsentProjectId(event.target.checked ? projectId : null)} /> Pristajem na slanje odabranih datoteka radi čitanja sadržaja i privatnu pohranu najviše 72 sata. Materijal mogu obrisati. Ova privola vrijedi za nova učitavanja u ovom projektu.</label>
    <div className="pis-material-upload"><select aria-label="Vrsta materijala" value={kind} onChange={(event) => setKind(event.target.value as MaterialKind)}>{MATERIAL_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><label className="pis-file-button">{busy ? 'Čitamo…' : 'Dodaj datoteku'}<input type="file" accept=".docx,.pdf,.txt,.md,image/*" disabled={busy || !consentAccepted} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} /></label></div>
    {message && <p className="pis-agent-message" role="status">{message}</p>}
    <input ref={reuploadInput} type="file" accept=".docx,.pdf,.txt,.md,image/*" hidden aria-label="Odaberi zamjenski materijal" onChange={(event) => { const file = event.target.files?.[0]; const material = materials.find((item) => item.id === reuploadId); if (file && material) void upload(file, material.kind, material.id); event.currentTarget.value = '' }} />
    {materials.length > 0 && <ul className="pis-material-list">{materials.map((material) => <li key={material.id} data-status={material.extractionStatus}><span className={`pis-status-dot is-${material.extractionStatus}`} aria-hidden="true" /><div><b title={material.name}>{material.name}</b><small>{materialStatus(material.extractionStatus)}</small></div><div className="pis-material-actions">{material.extractionStatus === 'failed' && <button type="button" onClick={() => reupload(material)} disabled={busy} aria-label="Ponovno učitaj materijal">{busy && reuploadId === material.id ? 'Odaberi datoteku…' : 'Ponovno učitaj materijal'}</button>}<button type="button" className="pis-material-delete" onClick={() => void deleteMaterial(material)} disabled={busy} aria-label={`Obriši materijal ${material.name}`}>{busy && deletingId === material.id ? 'Brišem…' : 'Obriši'}</button></div></li>)}</ul>}
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
  return typeof material.id === 'string' && material.id.trim().length > 0 && typeof material.name === 'string' && typeof material.extractionStatus === 'string' && ['pending', 'processing', 'extracted', 'partial', 'failed', 'needs_review'].includes(material.extractionStatus)
}

function replaceMaterial(materials: MaterialAssetV1[], replacedId: string, replacement: MaterialAssetV1): MaterialAssetV1[] {
  return [...materials.filter((material) => material.id !== replacedId), replacement]
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
