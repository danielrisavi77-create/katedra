// ============================================================
// KATEDRA — server-side .docx → tekst (bez trajnog spremanja)
//
// Student mora moći dati Katedri svoj stvarni Word rad bez ručnog
// copy-pastea (prijašnje stanje: .docx se u chatu tiho preskakao).
// Datoteka se obrađuje samo u memoriji ovog zahtjeva i odmah se
// odbacuje — ništa se ne piše na disk niti u bazu.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import mammoth from 'mammoth'
import { DOCX_LIMITS, validateDocxBuffer } from '@/lib/docx/validation'
import { reserveDocxUpload } from '@/lib/docx/rate-limit'
import { getRequestId, withRequestId } from '@/lib/observability/request-id.js'

const MAX_TEXT_CHARS = 250_000
const EXTRACTION_TIMEOUT_MS = 20_000

function extractRawTextWithTimeout(buffer) {
  let timer
  const timeout = new Promise((_, reject) => {
    const error = new Error('DOCX extraction timeout')
    error.code = 'DOCX_EXTRACTION_TIMEOUT'
    timer = setTimeout(() => reject(error), EXTRACTION_TIMEOUT_MS)
  })
  return Promise.race([
    mammoth.extractRawText({ buffer }),
    timeout,
  ]).finally(() => clearTimeout(timer))
}

export async function POST(req) {
  return withRequestId(await handlePOST(req), getRequestId(req))
}

async function handlePOST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Prijavi se.' })

  const reservation = reserveDocxUpload(user.id)
  if (!reservation.allowed) {
    return json(429, {
      error: reservation.reason === 'concurrency'
        ? 'Već obrađujem jedan dokument — pričekaj da završi.'
        : 'Previše DOCX pokušaja — pričekaj minutu.',
    })
  }

  try {
    let file
    try {
      const form = await req.formData()
      file = form.get('file')
    } catch {
      return json(400, { error: 'Neispravan zahtjev.' })
    }
    if (!file || typeof file.arrayBuffer !== 'function')
      return json(400, { error: 'Nedostaje datoteka.' })
    if (file.size > DOCX_LIMITS.maxBytes)
      return json(413, { error: 'Datoteka je prevelika (max 20 MB).' })

    const buffer = Buffer.from(await file.arrayBuffer())
    const validation = validateDocxBuffer(buffer, { name: file.name, type: file.type })
    if (!validation.ok) return json(validation.status, { error: validation.error })

    const extraction = await extractRawTextWithTimeout(buffer)
    const { value: text } = extraction
    const trimmed = text.trim()
    if (!trimmed)
      return json(422, { error: 'Nisam uspio pročitati sadržaj — datoteka je prazna ili nije valjan .docx.' })

    const truncated = trimmed.length > MAX_TEXT_CHARS
    return json(200, {
      text: truncated
        ? trimmed.slice(0, MAX_TEXT_CHARS) + '\n\n[…tekst skraćen, predugačak za jedan prilog…]'
        : trimmed,
      truncated,
    })
  } catch (error) {
    console.error('[parse-docx] greška:', error?.message)
    if (error?.code === 'DOCX_EXTRACTION_TIMEOUT') {
      return json(408, { error: 'Obrada DOCX-a traje predugo — pokušaj s manjom datotekom.' })
    }
    return json(422, { error: 'Nisam uspio pročitati ovu datoteku — provjeri da je stvarno .docx.' })
  } finally {
    reservation.release()
  }
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
