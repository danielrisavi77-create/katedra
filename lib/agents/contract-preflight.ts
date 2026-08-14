export const REQUIRED_AGENTIC_TABLES = ['katedra_project_locks', 'agent_runs', 'agent_steps', 'agent_payload_manifests'] as const
export const REQUIRED_AGENTIC_FUNCTIONS = ['lock_paid_project', 'create_agent_run', 'activate_agent_run', 'claim_agent_step', 'complete_agent_step', 'register_agent_payload', 'attach_agent_payloads_to_run', 'cleanup_expired_agent_payloads', 'pause_agent_run', 'resume_agent_run', 'cancel_agent_run'] as const

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
