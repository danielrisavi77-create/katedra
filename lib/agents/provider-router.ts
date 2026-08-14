import type { AgentCapability, AgentId, AgentProvider } from './contracts'

export interface ProviderRouter {
  providerFor(agent: AgentId, capability: AgentCapability): AgentProvider
}

export class ProviderCapabilityError extends Error {
  readonly code = 'provider_capability_unavailable'

  constructor(providerId: string, capability: AgentCapability, agent: AgentId) {
    super(`Provider ${providerId} nema capability ${capability} za agenta ${agent}.`)
    this.name = 'ProviderCapabilityError'
  }
}

export function createProviderRouter({
  providers,
  assignments,
}: {
  providers: AgentProvider[]
  assignments: Partial<Record<AgentId, string>>
}): ProviderRouter {
  const byId = new Map(providers.map((provider) => [provider.id, provider]))

  return {
    providerFor(agent, capability) {
      const providerId = assignments[agent]
      if (!providerId) throw new Error(`Nije konfiguriran provider za agenta ${agent}.`)
      const provider = byId.get(providerId)
      if (!provider) throw new Error(`Provider ${providerId} nije dostupan.`)
      if (!provider.capabilities.includes(capability)) {
        throw new ProviderCapabilityError(providerId, capability, agent)
      }
      return provider
    },
  }
}
