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

const MAX_SIZE = 20 * 1024 * 1024   // isti prag kao PDF u chatu (app/katedra-engine.js)
const MAX_TEXT_CHARS = 500_000      // sigurnosni strop prije ulaska u AI kontekst

export async function POST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Prijavi se.' })

  let file
  try {
    const form = await req.formData()
    file = form.get('file')
  } catch {
    return json(400, { error: 'Neispravan zahtjev.' })
  }
  if (!file || typeof file.arrayBuffer !== 'function')
    return json(400, { error: 'Nedostaje datoteka.' })
  if (file.size > MAX_SIZE)
    return json(413, { error: 'Datoteka je prevelika (max 20 MB).' })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { value: text } = await mammoth.extractRawText({ buffer })
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
    return json(422, { error: 'Nisam uspio pročitati ovu datoteku — provjeri da je stvarno .docx.' })
  }
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
