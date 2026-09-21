export const KATEDRA_PACKAGES = {
  seminarski: { eur: 29.9, tokens: 1_500_000, name: 'Katedra Seminarski Pass', workType: 'seminar' },
  zavrsni: { eur: 79.9, tokens: 4_500_000, name: 'Katedra Završni Pass', workType: 'final' },
  diplomski: { eur: 129.9, tokens: 12_000_000, name: 'Katedra Diplomski Pass', workType: 'graduate' },
}

// Product ids are canonical Lekta catalog ids. Keep the display/package
// metadata above backward-compatible while making the entitlement id explicit.
KATEDRA_PACKAGES.seminarski.productId = 'katedra_pass_seminarski'
KATEDRA_PACKAGES.zavrsni.productId = 'katedra_pass_zavrsni'
KATEDRA_PACKAGES.diplomski.productId = 'katedra_pass_diplomski'

export const PURCHASE_WINDOW_DAYS = {
  seminarski: 120,
  zavrsni: 240,
  diplomski: 365,
}

export function getKatedraPackage(productKey) {
  return KATEDRA_PACKAGES[productKey] ?? null
}
