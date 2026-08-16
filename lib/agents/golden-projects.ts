import type { AgentResultV1, AgentId, CitationEvidence, ClaimEvidence, VerificationStatus } from './contracts'

export type GoldenWorkType = 's' | 'z' | 'd'
export type GoldenSourcePolicy = 'uploaded_only' | 'uploaded_plus_suggestions' | 'web_research'

export interface GoldenAcademicProject {
  id: string
  label: string
  workType: GoldenWorkType
  sourcePolicy: GoldenSourcePolicy
  materialProfile: string[]
  result: Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'>
  expectedVerification: VerificationStatus
}

const CHECKED_AT = '2026-08-16T00:00:00.000Z'

const verifiedDoi: CitationEvidence = {
  id: 'source-verified',
  title: 'Verified academic source',
  authors: 'Ana Horvat',
  year: 2024,
  doi: '10.1234/example.2024',
  verified: true,
  verification: { status: 'verified', method: 'crossref', checkedAt: CHECKED_AT, titleMatch: true, authorMatch: true, yearMatch: true },
}

const verifiedClaim: ClaimEvidence = {
  id: 'claim-1',
  text: 'Primjer činjenične tvrdnje.',
  citationIds: ['source-verified'],
  support: [{ citationId: 'source-verified', quote: 'Relevantan odlomak izvora.', locator: 'str. 4' }],
}

function result(input: Partial<Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'>> = {}): Pick<AgentResultV1, 'agent' | 'output' | 'citations' | 'claims'> {
  return {
    agent: input.agent || 'writing',
    output: input.output === undefined ? 'Validan rezultat za provjeru.' : input.output,
    citations: input.citations || [verifiedDoi],
    ...(input.claims === undefined ? { claims: [verifiedClaim] } : { claims: input.claims }),
  }
}

export const GOLDEN_ACADEMIC_PROJECTS: readonly GoldenAcademicProject[] = [
  {
    id: 'golden-seminarski-clean',
    label: 'Seminarski s verificiranim DOI izvorom i dokaznim odlomkom',
    workType: 's',
    sourcePolicy: 'uploaded_only',
    materialProfile: ['draft', 'source', 'mentor'],
    result: result(),
    expectedVerification: 'verified',
  },
  {
    id: 'golden-zavrsni-web-research',
    label: 'Završni rad s web research izvorom koji prolazi identitet',
    workType: 'z',
    sourcePolicy: 'web_research',
    materialProfile: ['rules', 'source'],
    result: result({ agent: 'sources' }),
    expectedVerification: 'verified',
  },
  {
    id: 'golden-diplomski-missing-passage',
    label: 'Diplomski rad kojem nedostaje dokazni odlomak',
    workType: 'd',
    sourcePolicy: 'uploaded_plus_suggestions',
    materialProfile: ['draft', 'source', 'mentor', 'rules'],
    result: result({ claims: [{ ...verifiedClaim, support: undefined }] }),
    expectedVerification: 'needs_revision',
  },
  {
    id: 'golden-seminarski-unverified-source',
    label: 'Seminarski s izvorom koji provider označava, ali server ne potvrđuje',
    workType: 's',
    sourcePolicy: 'uploaded_only',
    materialProfile: ['draft', 'source'],
    result: result({ citations: [{ ...verifiedDoi, verified: false, verification: undefined }] }),
    expectedVerification: 'blocked',
  },
  {
    id: 'golden-zavrsni-missing-claims',
    label: 'Završni rad s tekstom bez strukturirane mape tvrdnji',
    workType: 'z',
    sourcePolicy: 'uploaded_plus_suggestions',
    materialProfile: ['draft', 'source'],
    result: result({ claims: [] }),
    expectedVerification: 'blocked',
  },
  {
    id: 'golden-diplomski-unsupported-passage',
    label: 'Diplomski rad čiji dokazni odlomak nije vezan uz citat',
    workType: 'd',
    sourcePolicy: 'web_research',
    materialProfile: ['draft', 'source', 'notes'],
    result: result({ claims: [{ ...verifiedClaim, support: [{ citationId: 'other-source', quote: 'Nepovezan odlomak.' }] }] }),
    expectedVerification: 'blocked',
  },
  {
    id: 'golden-seminarski-retracted-source',
    label: 'Seminarski s povučenim izvorom',
    workType: 's',
    sourcePolicy: 'uploaded_only',
    materialProfile: ['draft', 'source'],
    result: result({ citations: [{ ...verifiedDoi, verified: false, verification: { status: 'blocked', method: 'crossref', checkedAt: CHECKED_AT, retracted: true } }] }),
    expectedVerification: 'blocked',
  },
  {
    id: 'golden-zavrsni-empty-output',
    label: 'Završni rad bez rezultata providera',
    workType: 'z',
    sourcePolicy: 'web_research',
    materialProfile: ['rules', 'source'],
    result: result({ output: '   ' }),
    expectedVerification: 'needs_revision',
  },
  {
    id: 'golden-diplomski-unmapped-claim',
    label: 'Diplomski rad s tvrdnjom bez povezanog izvora',
    workType: 'd',
    sourcePolicy: 'uploaded_plus_suggestions',
    materialProfile: ['draft', 'source', 'mentor'],
    result: result({ claims: [{ ...verifiedClaim, citationIds: [] }] }),
    expectedVerification: 'blocked',
  },
  {
    id: 'golden-zavrsni-independent-review-needed',
    label: 'Završni rad s identitetom izvora koji još čeka neovisnu provjeru',
    workType: 'z',
    sourcePolicy: 'web_research',
    materialProfile: ['draft', 'source', 'rules'],
    result: result({ citations: [{ ...verifiedDoi, verification: { ...verifiedDoi.verification!, status: 'needs_review' } }] }),
    expectedVerification: 'blocked',
  },
] as const
