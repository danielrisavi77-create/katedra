import type { AcademicRuleStatus } from './types'

export type AcademicVisibility = {
  label: string
  description: string
  canClaimFacultyRules: boolean
  canPurchasePass: boolean
  aiMode: 'full' | 'generic' | 'coaching'
}

export function academicVisibilityForStatus(status: AcademicRuleStatus): AcademicVisibility {
  if (status === 'verified') {
    return {
      label: 'Pravila verificirana',
      description: 'Profil ima potvrđena pravila ustanove i datum provjere.',
      canClaimFacultyRules: true,
      canPurchasePass: true,
      aiMode: 'full',
    }
  }
  if (status === 'partial') {
    return {
      label: 'Pravila djelomično potvrđena',
      description: 'Dio pravila je poznat, ali Katedra ne tvrdi da je profil potpun.',
      canClaimFacultyRules: false,
      canPurchasePass: false,
      aiMode: 'generic',
    }
  }
  if (status === 'research') {
    return {
      label: 'Pravila su u istraživanju',
      description: 'Dostupan je opći akademski način rada bez fakultetskih obećanja.',
      canClaimFacultyRules: false,
      canPurchasePass: false,
      aiMode: 'generic',
    }
  }
  return {
    label: 'Opća pravila rada',
    description: 'Nije povezan verificirani fakultetski profil.',
    canClaimFacultyRules: false,
    canPurchasePass: false,
    aiMode: 'generic',
  }
}
