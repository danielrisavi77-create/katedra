'use client'

import { useState } from 'react'

import type { AiUsageLedgerRow, AiUsageLedgerV1 } from '../../../lib/agents/usage-ledger'

export function AiUsageLedger({ ledger, onDownload }: { ledger: AiUsageLedgerV1; onDownload?: () => void }) {
  const [open, setOpen] = useState(false)
  const download = () => {
    if (onDownload) {
      onDownload()
      return
    }
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `katedra-ai-zapis-${safeFilename(ledger.runId)}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return <details className="pis-ai-usage-ledger" role="group" aria-label="AI zapis" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <span>
        <span className="pis-kicker">Transparentnost procesa</span>
        <strong>AI zapis</strong>
      </span>
      <span className="pis-ai-usage-summary"><b>{callLabel(ledger.totals.calls)}</b><small>{ledger.totals.inputTokens} ulaznih · {ledger.totals.outputTokens} izlaznih tokena</small></span>
    </summary>
    {open && <div className="pis-ai-usage-ledger-body">
      <div className="pis-ai-usage-ledger-intro">
        <p>Pregled korištenja po koracima: agent, verifikator, pokušaj, potrošnja i status naplate. Sadrži samo procesne metapodatke.</p>
        {ledger.totals.pendingBilling > 0 && <p className="pis-ai-usage-warning" role="status">{ledger.totals.pendingBilling} poziv čeka potvrdu naplate.</p>}
        <button type="button" onClick={download}>Preuzmi AI zapis (.json)</button>
      </div>
      <div className="pis-ai-usage-table-scroll">
        <table>
          <thead><tr><th scope="col">Korak</th><th scope="col">Agent</th><th scope="col">Verifikator</th><th scope="col">Pokušaj</th><th scope="col">Potrošnja</th><th scope="col">Naplata</th><th scope="col">Primjena</th></tr></thead>
          <tbody>{ledger.rows.map((row) => <LedgerRow key={`${row.stepId}:${row.attempt}:${row.occurredAt || ''}`} row={row} />)}</tbody>
        </table>
      </div>
    </div>}
  </details>
}

function LedgerRow({ row }: { row: AiUsageLedgerRow }) {
  return <tr>
    <th scope="row"><span>{row.phase}</span><small>{row.stepId}</small></th>
    <td><span>{row.agent}</span>{row.provider && <small>{row.provider}</small>}</td>
    <td>{row.verifier}</td>
    <td>{row.attempt}/3</td>
    <td>{row.inputTokens} + {row.outputTokens}</td>
    <td><span className={`pis-ai-usage-status is-${row.billingState}`}>{billingLabel(row.billingState)}</span></td>
    <td><span className={`pis-ai-usage-status is-${row.applied}`}>{appliedLabel(row.applied)}</span></td>
  </tr>
}

function callLabel(calls: number): string {
  return `${calls} ${calls === 1 ? 'poziv' : 'poziva'}`
}

function billingLabel(state: AiUsageLedgerRow['billingState']): string {
  return ({ settled: 'Podmireno', released: 'Vraćeno', pending_reconciliation: 'Čeka usklađenje', unknown: 'Nije poznato' })[state]
}

function appliedLabel(state: AiUsageLedgerRow['applied']): string {
  return ({ accepted: 'Prihvaćeno', rejected: 'Odbačeno', pending: 'Čeka odluku', not_applicable: 'Nije primjenjivo' })[state]
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '').slice(0, 60) || 'run'
}
