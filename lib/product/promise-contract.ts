import { KATEDRA_PASS_PRODUCT_IDS } from '../katedra-pass-catalog.js'
import { KATEDRA_PACKAGES } from '../stripe/catalog.js'
import { PRODUCT_CAPABILITIES } from './capabilities'
import { type ProjectCapability, type ProductTier } from './lifecycle'
import { FUTURE_PRODUCT_MODULES, PAID_V1_MODULES, passModulesForWorkType, type FutureProductModuleId, type ProductModuleId } from './v1-modules'

export type PaidProductTier = Exclude<ProductTier, 'free'>

export type ProductPromise = {
  tier: PaidProductTier
  productId: string
  workType: PaidProductTier
  capabilities: readonly ProjectCapability[]
  modules: readonly ProductModuleId[]
}

const PAID_TIERS: readonly PaidProductTier[] = ['seminarski', 'zavrsni', 'diplomski']
const FUTURE_MODULE_IDS = new Set<FutureProductModuleId>(FUTURE_PRODUCT_MODULES.map((module) => module.id as FutureProductModuleId))

function paidModuleIds(): ProductModuleId[] {
  return PAID_V1_MODULES
    .map((module) => module.id)
    .filter((id): id is ProductModuleId => !FUTURE_MODULE_IDS.has(id as FutureProductModuleId))
}

const PRODUCT_PROMISES: Record<PaidProductTier, ProductPromise> = {
  seminarski: {
    tier: 'seminarski',
    productId: KATEDRA_PACKAGES.seminarski.productId,
    workType: 'seminarski',
    capabilities: PRODUCT_CAPABILITIES.seminarski,
    modules: paidModuleIds(),
  },
  zavrsni: {
    tier: 'zavrsni',
    productId: KATEDRA_PACKAGES.zavrsni.productId,
    workType: 'zavrsni',
    capabilities: PRODUCT_CAPABILITIES.zavrsni,
    modules: paidModuleIds(),
  },
  diplomski: {
    tier: 'diplomski',
    productId: KATEDRA_PACKAGES.diplomski.productId,
    workType: 'diplomski',
    capabilities: PRODUCT_CAPABILITIES.diplomski,
    modules: paidModuleIds(),
  },
}

export function productPromiseForWorkType(value: string): ProductPromise {
  if (!PAID_TIERS.includes(value as PaidProductTier)) throw new Error('Nepoznat proizvod')
  return PRODUCT_PROMISES[value as PaidProductTier]
}

export function auditProductPromises(): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  const catalogIds = new Set(KATEDRA_PASS_PRODUCT_IDS)
  const futureIds = new Set(FUTURE_PRODUCT_MODULES.map((module) => module.id))
  const paidModuleIds = PAID_V1_MODULES.map((module) => module.id)

  for (const tier of PAID_TIERS) {
    const promise = PRODUCT_PROMISES[tier]
    const packageEntry = KATEDRA_PACKAGES[tier]
    const legacyWorkType = tier === 'seminarski' ? 's' : tier === 'zavrsni' ? 'z' : 'd'
    const uiModules = passModulesForWorkType(legacyWorkType).map((module) => module.id).filter((id): id is ProductModuleId => !futureIds.has(id as FutureProductModuleId))

    if (!packageEntry || packageEntry.productId !== promise.productId) issues.push(`${tier}: katalog i checkout productId nisu usklađeni`)
    if (!catalogIds.has(promise.productId)) issues.push(`${tier}: entitlement productId nije u canonical Pass katalogu`)
    if (promise.workType !== tier) issues.push(`${tier}: workType obećanja nije kanonski`)
    if (JSON.stringify(promise.capabilities) !== JSON.stringify(PRODUCT_CAPABILITIES[tier])) issues.push(`${tier}: capability matrix i obećanje nisu usklađeni`)
    if (JSON.stringify(uiModules) !== JSON.stringify(paidModuleIds)) issues.push(`${tier}: Pass UI prikazuje drugi opseg od V1 modula`)
    if (promise.modules.some((module) => futureIds.has(module))) issues.push(`${tier}: budući modul je javno obećan u V1`)
  }

  return { valid: issues.length === 0, issues }
}
