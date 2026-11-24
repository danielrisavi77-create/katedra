'use client'

import { useEffect, useMemo, useState } from 'react'

import { daysUntilDeadline, recommendedDeadlineAction, reminderTier, shouldShowDeadlineReminder } from '../../../lib/project/deadline-reminders'

export function DeadlineReminderBanner({ projectId, deadline, stage, authenticated, institution, workType, onNavigate }: { projectId: string; deadline?: string; stage: string; authenticated: boolean; institution?: string; workType?: string; onNavigate?: () => void }) {
  const daysLeft = useMemo(() => deadline ? daysUntilDeadline(deadline) : null, [deadline])
  const tier = reminderTier(daysLeft)
  const key = deadline ? `katedra_deadline_banner:${projectId}:${deadline}` : ''
  const dismissalValue = tier || (daysLeft === null ? '' : `window-${daysLeft}`)
  const [dismissed, setDismissed] = useState(() => {
    if (!key) return false
    try { return localStorage.getItem(key) === dismissalValue } catch { return false }
  })
  const [emailConsent, setEmailConsent] = useState(false)
  const [emailState, setEmailState] = useState<'idle' | 'saving' | 'saved' | 'disabling' | 'disabled' | 'error'>('idle')

  useEffect(() => {
    if (!authenticated || !projectId || !deadline) return
    let cancelled = false
    void fetch(`/api/reminders/deadline?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => {
        if (cancelled || body?.enabled !== true) return
        if (body.deadline && body.deadline !== deadline) return
        setEmailConsent(true)
        setEmailState('saved')
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [authenticated, deadline, projectId])

  if (!shouldShowDeadlineReminder(daysLeft) || dismissed || daysLeft === null) return null

  const dismiss = () => {
    try { localStorage.setItem(key, dismissalValue) } catch { /* optional */ }
    setDismissed(true)
  }

  const saveEmailConsent = async (checked: boolean) => {
    setEmailConsent(checked)
    if (!checked) return
    if (!authenticated) { setEmailState('error'); return }
    setEmailState('saving')
    try {
      const response = await fetch('/api/reminders/deadline', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, deadline, consent: true, institution, workType }),
      })
      if (!response.ok) throw new Error('Reminder nije spremljen.')
      setEmailState('saved')
    } catch { setEmailState('error') }
  }

  const disableEmailConsent = async () => {
    if (!authenticated) return
    setEmailState('disabling')
    try {
      const response = await fetch(`/api/reminders/deadline?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Reminder nije isključen.')
      setEmailConsent(false)
      setEmailState('disabled')
    } catch { setEmailState('error') }
  }

  return <aside className="pis-deadline-banner" role="status">
    <div><strong>Rok je za {daysLeft} dana</strong><span>Preporučeni korak: {recommendedDeadlineAction(stage)}.</span></div>
    <div className="pis-deadline-actions"><button type="button" onClick={onNavigate}>{recommendedDeadlineAction(stage)}</button><button type="button" className="pis-quiet-button" onClick={dismiss}>Kasnije</button></div>
    <label className="pis-deadline-consent"><input type="checkbox" checked={emailConsent} onChange={(event) => void saveEmailConsent(event.target.checked)} disabled={emailState === 'saving' || emailState === 'saved' || emailState === 'disabling'} /><span>{emailState === 'saved' ? 'E-mail podsjetnik je uključen.' : emailState === 'disabled' ? 'E-mail podsjetnik je isključen.' : emailState === 'error' ? (authenticated ? 'E-mail podsjetnik nije moguće uključiti.' : 'Prijavi se za e-mail podsjetnik.') : 'Želim i e-mail podsjetnik'}</span></label>
    {emailState === 'saved' && <button type="button" className="pis-quiet-button" onClick={() => void disableEmailConsent()}>Isključi e-mail podsjetnik</button>}
  </aside>
}
