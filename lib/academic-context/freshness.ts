export type AcademicFreshness = {
  validDate: boolean
  ageDays?: number
  isStale: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isValidAcademicDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export function assessAcademicFreshness(
  verifiedAt: string | undefined,
  options: { now?: Date; maxAgeDays?: number } = {},
): AcademicFreshness {
  if (!isValidAcademicDate(verifiedAt)) return { validDate: false, isStale: false }
  const verifiedDate = new Date(`${verifiedAt}T00:00:00.000Z`)
  if (Number.isNaN(verifiedDate.getTime())) return { validDate: false, isStale: false }
  const now = options.now || new Date()
  const ageDays = Math.max(0, Math.floor((now.getTime() - verifiedDate.getTime()) / DAY_MS))
  const maxAgeDays = options.maxAgeDays ?? 365
  return { validDate: true, ageDays, isStale: ageDays > maxAgeDays }
}
