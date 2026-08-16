// ============================================================
// KATEDRA — server-side .docx → tekst (bez trajnog spremanja)
//
// Student mora moći dati Katedri svoj stvarni Word rad bez ručnog
// copy-pastea (prijašnje stanje: .docx se u chatu tiho preskakao).
// Datoteka se obrađuje samo u memoriji ovog zahtjeva i odmah se
// odbacuje — ništa se ne piše na disk niti u bazu.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import mammoth from 'mammoth'
import { DOCX_LIMITS, validateDocxBuffer } from '@/lib/docx/validation'
import { reserveDocxUpload } from '@/lib/docx/rate-limit'
import { isDistributedRateLimitConfigured, releaseRateLimitReservation, reserveDistributedRequest } from '@/lib/ai/rate-limit'
import { createRequestContext, withRequestId } from '@/lib/observability/request-id.js'
import { privateJson } from '@/lib/observability/private-response.js'
import { readMultipartForm } from '@/lib/http/multipart.js'

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
  // Keep the client id for tracing only. A repeated client id must not make
  // two concurrent uploads share one distributed reservation.
  const requestContext = createRequestContext(req)
  return withRequestId(await handlePOST(req, requestContext), requestContext.traceRequestId)
}

async function handlePOST(req, requestContext) {
  const { traceRequestId, reservationRequestId } = requestContext
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'Prijavi se.' })

  const distributedRateLimit = isDistributedRateLimitConfigured()
  if (process.env.NODE_ENV === 'production' && !distributedRateLimit) {
    console.error(JSON.stringify({ eventName: 'docx_rate_limit_store_unavailable', userId: user.id, requestId: traceRequestId }))
    return json(503, { error: 'Ograničavanje DOCX zahtjeva još nije konfigurirano.' })
  }

  let reservation
  try {
    reservation = distributedRateLimit
      ? await reserveDistributedRequest(createAdminClient(), {
        userId: user.id,
        requestId: reservationRequestId,
        estimatedCharge: 0,
      })
      : reserveDocxUpload(user.id)
  } catch (error) {
    console.error(JSON.stringify({ eventName: 'docx_rate_limit_reservation_failed', userId: user.id, requestId: traceRequestId, error: error?.message }))
    return json(503, { error: 'Ograničavanje DOCX zahtjeva trenutno nije dostupno.' })
  }
  if (!reservation.allowed && reservation.reason === 'unavailable') {
    return json(503, { error: 'Ograničavanje DOCX zahtjeva trenutno nije dostupno.' })
  }
  if (!reservation.allowed) {
    return json(429, {
      error: reservation.reason === 'concurrency'
        ? 'Već obrađujem jedan dokument — pričekaj da završi.'
        : 'Previše DOCX pokušaja — pričekaj minutu.',
    })
  }

  try {
    const form = await readMultipartForm(req, { maxBytes: DOCX_LIMITS.maxBytes + 1 * 1024 * 1024, maxFileBytes: DOCX_LIMITS.maxBytes })
    if (!form.ok) return json(form.status, { error: form.error })
    const file = form.file
    if (!file || !Buffer.isBuffer(file.buffer))
      return json(400, { error: 'Nedostaje datoteka.' })
    if (file.size > DOCX_LIMITS.maxBytes)
      return json(413, { error: 'Datoteka je prevelika (max 20 MB).' })

    const buffer = file.buffer
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
    await releaseRateLimitReservation(reservation, (error, attempt) => {
      console.error(JSON.stringify({ eventName: 'docx_rate_limit_release_failed', attempt, userId: user.id, requestId: traceRequestId, error: error?.message }))
    })
  }
}

function json(status, data) {
  return privateJson(data, { status })
}
