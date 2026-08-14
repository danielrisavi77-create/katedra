export const KATEDRA_PASS_PRODUCT_IDS = [
  'katedra_pass_seminarski',
  'katedra_pass_zavrsni',
  'katedra_pass_diplomski',
]

export function katedraPassProductFilter() {
  return `product_id.is.null,product_id.in.(${KATEDRA_PASS_PRODUCT_IDS.join(',')})`
}
