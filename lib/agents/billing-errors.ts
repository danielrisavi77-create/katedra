export class AgentBillingReconciliationError extends Error {
  readonly billingState: 'released' | 'pending_reconciliation'

  constructor(message: string, billingState: 'released' | 'pending_reconciliation') {
    super(message)
    this.name = 'AgentBillingReconciliationError'
    this.billingState = billingState
  }
}
