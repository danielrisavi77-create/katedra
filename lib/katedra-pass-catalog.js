export const KATEDRA_PASS_PRODUCT_IDS = [
  'katedra_pass_seminarski',
  'katedra_pass_zavrsni',
  'katedra_pass_diplomski',
]

export const KATEDRA_PASS_WORK_TYPES = [
  'seminarski',
  'zavrsni',
  'diplomski',
]

export function katedraPassProductId(productKey) {
  const productId = `katedra_pass_${String(productKey || '').trim()}`
  return KATEDRA_PASS_PRODUCT_IDS.includes(productId) ? productId : null
}

export function katedraPassProductFilter() {
  return `product_id.is.null,product_id.in.(${KATEDRA_PASS_PRODUCT_IDS.join(',')})`
}

export function katedraPassAccountFilter() {
  return `and(product_id.is.null,work_type.in.(${KATEDRA_PASS_WORK_TYPES.join(',')})),product_id.in.(${KATEDRA_PASS_PRODUCT_IDS.join(',')})`
}
