import { AGENT_IDS, createAgentContract, type AgentContract, type AgentId, type AgentProvider } from './contracts'
import type { ProviderRouter } from './provider-router'

export interface AgentRegistry {
  contractFor(agent: AgentId): AgentContract
  contracts(): AgentContract[]
}

export function createAgentRegistry(router: Pick<ProviderRouter, 'providerFor'>): AgentRegistry {
  const contracts = AGENT_IDS.map((agent) => createAgentContract(agent, router.providerFor(agent, capabilityFor(agent))))
  const byAgent = new Map(contracts.map((contract) => [contract.agent, contract]))

  return {
    contractFor(agent) {
      const contract = byAgent.get(agent)
      if (!contract) throw new Error(`Agent ${agent} nije registriran.`)
      return contract
    },
    contracts: () => [...contracts],
  }
}

function capabilityFor(agent: AgentId): AgentProvider['capabilities'][number] {
  if (agent === 'sources') return 'web_research'
  if (agent === 'intake') return 'vision'
  return 'text'
}
