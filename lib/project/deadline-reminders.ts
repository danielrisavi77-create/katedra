import type { ProjectStage } from '../academic-suite/contracts'

export type ReminderTier = '7d' | '3d' | '1d'

export function daysUntilDeadline(deadline: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null
  const target = Date.UTC(Number(deadline.slice(0, 4)), Number(deadline.slice(5, 7)) - 1, Number(deadline.slice(8, 10)))
  if (!Number.isFinite(target)) return null
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((target - today) / 86_400_000)
}

export function reminderTier(daysLeft: number | null): ReminderTier | null {
  if (daysLeft === 7) return '7d'
  if (daysLeft === 3) return '3d'
  if (daysLeft === 1) return '1d'
  return null
}

export function shouldShowDeadlineReminder(daysLeft: number | null): boolean {
  return reminderTier(daysLeft) !== null
}

export function recommendedDeadlineAction(stage: ProjectStage | string): string {
  if (stage === 'writing') return 'Nastavi pisati aktivnu sekciju'
  if (stage === 'review' || stage === 'mentor-review' || stage === 'revision') return 'Pregledaj otvorene nalaze'
  if (stage === 'lekta' || stage === 'lekta-preflight') return 'Pokreni Lekta provjeru'
  return 'Otvori sljedeći korak'
}
