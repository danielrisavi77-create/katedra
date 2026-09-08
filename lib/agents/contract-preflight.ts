export const REQUIRED_AGENTIC_TABLES = [
  'academic_projects',
  'entitlements',
  'katedra_project_locks',
  'agent_runs',
  'agent_steps',
  'agent_payload_manifests',
  'agent_payload_upload_intents',
  'agent_material_run_lineage',
  'katedra_wallets',
  'katedra_usage',
  'katedra_request_reservations',
  'katedra_billing_attempts',
  'katedra_pass_refunds',
] as const

export const REQUIRED_AGENTIC_FUNCTIONS = [
  'lock_paid_project',
  'create_agent_run',
  'activate_agent_run',
  'cleanup_stale_initializing_agent_run',
  'claim_agent_step',
  'complete_agent_step',
  'register_agent_payload',
  'reserve_agent_run_context',
  'commit_agent_run_context',
  'approve_agent_run_context_plan',
  'record_agent_run_snapshot_consent',
  'revoke_agent_run_consent',
  'finalize_agent_run_payload_deletion',
  'reserve_agent_result_payload',
  'reserve_material_payload',
  'complete_material_payload',
  'list_material_payload_privacy',
  'withdraw_material_payload_consent',
  'begin_agent_payload_upload',
  'finish_agent_payload_upload',
  'agent_payload_deletion_ready',
  'claim_agent_payload_upload_reconciliation',
  'confirm_agent_payload_upload',
  'list_pending_agent_payload_deletions',
  'finalize_agent_payload_deletions',
  'attach_agent_payloads_to_run',
  'replace_agent_payloads_for_run',
  'tombstone_agent_payload',
  'list_active_agent_payloads',
  'cleanup_expired_agent_payloads',
  'pause_agent_run',
  'resume_agent_run',
  'cancel_agent_run',
  'katedra_reserve_request',
  'katedra_release_request',
  'katedra_consume',
  'katedra_mark_pending',
  'record_katedra_billing_usage',
  'reconcile_katedra_billing',
  'list_reconcilable_katedra_billing',
  'claim_katedra_pass_refund',
  'mark_katedra_refund_attempt',
  'record_katedra_pass_refund',
  'list_pending_katedra_pass_refunds',
  'read_katedra_pass_refund',
] as const

export interface AgenticContractInspector {
  hasTable: (name: string) => Promise<boolean>
  hasFunction: (name: string) => Promise<boolean>
}

export interface AgenticContractStatus {
  ready: boolean
  missingTables: string[]
  missingFunctions: string[]
}

export async function inspectAgenticContract(inspector: AgenticContractInspector): Promise<AgenticContractStatus> {
  const [tables, functions] = await Promise.all([
    Promise.all(REQUIRED_AGENTIC_TABLES.map(async (name) => [name, await inspector.hasTable(name)] as const)),
    Promise.all(REQUIRED_AGENTIC_FUNCTIONS.map(async (name) => [name, await inspector.hasFunction(name)] as const)),
  ])
  const missingTables = tables.filter(([, exists]) => !exists).map(([name]) => name)
  const missingFunctions = functions.filter(([, exists]) => !exists).map(([name]) => name)
  return { ready: missingTables.length === 0 && missingFunctions.length === 0, missingTables, missingFunctions }
}
