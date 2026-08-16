'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeLektaHandoffHashForLegacyEngine } from '../../../lib/academic-suite/handoff'
import { ensureGuestProjectIdentity } from '../../../lib/academic-suite/guest-project'
import { buildProjectAuthRedirect } from '../../../lib/auth/project-redirect'
import { useAuth } from '../../../lib/hooks/useAuth'
import { createTextDeltaParser } from '../../../lib/manuscript/client-sse'
import { mergeVerifiedAgenticSections } from '../../../lib/manuscript/agentic-merge'
import { createCompletionScan } from '../../../lib/project/completion-scan'
import { hasCanonicalAgenticPass } from '../../../lib/product/workflow-access'
import type { AgenticDraftV1 } from '../../../lib/manuscript/agentic-revisions'
import { shouldShowManuscriptOnboarding } from '../../../lib/manuscript/onboarding-state'
import { buildAiMessages, capabilityForAction, type ManuscriptAiAction, type ManuscriptMaterialContext } from '../../../lib/manuscript/context'
import { exportManuscriptDocx } from '../../../lib/manuscript/export-docx'
import { migrateLegacyProject } from '../../../lib/manuscript/migration'
import { serverStateToManifest } from '../../../lib/manuscript/server-project'
import { appendPlainText, countDocumentWords, createSection, moveSection, plainTextDocument, removeSection } from '../../../lib/manuscript/model'
import { createAutosaveController } from '../../../lib/manuscript/autosave'
import { validateImportedText, validateTextImport } from '../../../lib/manuscript/import-validation'
import { validateManuscriptBackup } from '../../../lib/manuscript/backup-validation'
import { createAiProposal, proposalApplyTarget } from '../../../lib/manuscript/proposals'
import { canApplyProposal, isCurrentAiRequest } from '../../../lib/manuscript/proposal-guards'
import { createManuscriptStore } from '../../../lib/manuscript/storage'
import { getBrowserStorage, readStorage, writeStorage } from '../../../lib/manuscript/browser-storage'
import { createUnreadableMaterial, isDocxFile, readLocalTextMaterial, readStoredComposerMaterials, writeStoredComposerMaterials, type ComposerMaterialV1 } from '../../../lib/manuscript/composer-materials'
import { syncMetadata, type SyncStatus } from '../../../lib/manuscript/sync-status'
import { parseProjectMode, projectModeAllowsNavigation, projectModeStorageKey, projectModeWorkspaceView, restoreProjectMode, type ProjectMode } from '../../../lib/manuscript/project-mode'
import { initialAgenticWorkspacePhase, initialWorkspaceView, nextAgenticWorkspacePhase, parseWorkspaceView, type AgenticWorkspacePhase, type WorkspaceViewPreference } from '../../../lib/manuscript/workspace-view'
import { selectWorkspaceProject } from '../../../lib/manuscript/workspace-project'
import type {
  AiProposalV1,
  LegacyWorkType,
  ManuscriptSectionStatus,
  ManuscriptSourceV1,
  ManuscriptV1,
  TiptapNode,
} from '../../../lib/manuscript/types'
import { AssistantPanel } from './assistant-panel'
import { AgentStudioShell } from './agent-studio-shell'
import { ManuscriptEditor, type EditorApplyRequest, type EditorSelection } from './manuscript-editor'
import { OnboardingFlow, type OnboardingInitialValues, type OnboardingResult } from './onboarding-flow'
import { OutlinePanel } from './outline-panel'
import { PassDialog } from './pass-dialog'
import { PaidProjectSetup } from './paid-project-setup'
import { FreeProjectPlan } from './free-project-plan'
import { ProjectHome } from './project-home'
import { ProjectModeOnboarding } from './project-mode-onboarding'
import { ProjectDrawer } from './project-drawer'
import { WritingComposer } from './writing-composer'
import type { ProjectNavItem } from './project-navigation'
import { projectNavigationDestination, type ProjectDrawerTab } from './project-navigation-routing'
import { normalizeMobileView, normalizeWorkspaceResumeState, WorkspaceShell, type MobileView, type SaveStatus, type WorkspaceView } from './workspace-shell'

const READY_PREFIX = 'katedra_manuscript_ready:'
const PROJECT_SETUP_PREFIX = 'katedra_project_setup_v1:'
const MENTOR_PREFIX = 'katedra_mentor_tasks:'
const WORKSPACE_VIEW_PREFIX = 'katedra_workspace_view_v2:'
const MOBILE_VIEW_PREFIX = 'katedra_mobile_workspace_view_v1:'
const AGENTIC_PHASE_PREFIX = 'katedra_agentic_workspace_phase_v1:'

type MentorTask = { id: string; text: string; done: boolean; sectionId?: string }
type PassStatus = 'idle' | 'checking' | 'active' | 'admin' | 'needed' | 'error'
export type LektaWorkspaceSummary = {
  score: number | null
  checkedAt: string
  fixedTotal: number
  issues: Array<{ id: string; label?: string; severity?: string; status?: string }>
}

export default function WorkspaceClient({ agenticAvailable = false, webResearchAvailable = false }: { agenticAvailable?: boolean; webResearchAvailable?: boolean }) {
  const { user, loading: authLoading } = useAuth()
  const storeRef = useRef<ReturnType<typeof createManuscriptStore> | null>(null)
  const composerMaterialsHydratedRef = useRef(false)
  const localManuscriptFoundRef = useRef(false)
  const serverProjectHydratedRef = useRef<string | null>(null)
  const aiRequestRef = useRef<{ id: string; sectionId: string; controller: AbortController } | null>(null)
  const activeSectionIdRef = useRef<string | null>(null)
  const manuscriptRef = useRef<ManuscriptV1 | null>(null)
  const bootingRef = useRef(true)
  const onboardingRef = useRef(true)
  const autosaveRef = useRef<ReturnType<typeof createAutosaveController<ManuscriptV1>> | null>(null)
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [initialTip, setInitialTip] = useState<LegacyWorkType | undefined>()
  const [scanMode, setScanMode] = useState(false)
  const [completionScan, setCompletionScan] = useState<ReturnType<typeof createCompletionScan> | null>(null)
  const [projectHome, setProjectHome] = useState(false)
  const [manuscript, setManuscript] = useState<ManuscriptV1 | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local_only')
  const [mobileView, setMobileView] = useState<MobileView>('editor')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<ProjectDrawerTab>('plan')
  const [projectMode, setProjectMode] = useState<ProjectMode | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [agenticMode, setAgenticMode] = useState(false)
  const [agenticView, setAgenticView] = useState<AgenticWorkspacePhase>('preparation')
  const [selection, setSelection] = useState<EditorSelection | null>(null)
  const [proposal, setProposal] = useState<AiProposalV1 | null>(null)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [composerMaterials, setComposerMaterials] = useState<ManuscriptMaterialContext[]>([])
  const [applyRequest, setApplyRequest] = useState<EditorApplyRequest | null>(null)
  const [acceptedFlash, setAcceptedFlash] = useState(false)
  const [mentorTasks, setMentorTasks] = useState<MentorTask[]>([])
  const [legacyChecks, setLegacyChecks] = useState<Record<string, boolean>>({})
  const [passStatus, setPassStatus] = useState<PassStatus>('idle')
  const [passOpen, setPassOpen] = useState(false)
  const [checkoutNotice, setCheckoutNotice] = useState('')
  const [lektaSummary, setLektaSummary] = useState<LektaWorkspaceSummary>({ score: null, checkedAt: '', fixedTotal: 0, issues: [] })
  useEffect(() => {
    autosaveRef.current = createAutosaveController<ManuscriptV1>({
      save: async (value) => { await storeRef.current?.save(value) },
      onStatus: (status) => setSaveStatus(status),
    })
    return () => {
      autosaveRef.current?.cancel()
    }
  }, [])

  useEffect(() => {
    manuscriptRef.current = manuscript
    bootingRef.current = booting
    onboardingRef.current = showOnboarding
  }, [booting, manuscript, showOnboarding])

  const flushCurrentManuscript = useCallback(() => {
    const value = !bootingRef.current && !onboardingRef.current ? manuscriptRef.current : null
    return autosaveRef.current?.flush(value) || Promise.resolve()
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      normalizeLektaHandoffHashForLegacyEngine()
      const params = new URLSearchParams(window.location.search)
      const queryTip = params.get('tip')
      if (queryTip === 's' || queryTip === 'z' || queryTip === 'd') setInitialTip(queryTip)
      setScanMode(params.get('screen') === 'scan')

      const requestedProjectId = params.get('projectId')
      const localManifest = readJson<Record<string, unknown>>('rp_manifest')
      const identity = requestedProjectId ? { projectId: requestedProjectId } : ensureGuestProjectIdentity()
      const selectedProject = selectWorkspaceProject({
        requestedProjectId,
        localManifest,
        fallbackProjectId: identity.projectId,
      })
      const manifest = selectedProject.manifest
      const legacyState = selectedProject.useLegacyState
        ? readJson<{ checks?: Record<string, boolean>; gen?: Record<string, unknown>; mentorTasks?: MentorTask[] }>('rp_state')
        : null
      const migrated = migrateLegacyProject({ manifest, legacyState })
      storeRef.current = createManuscriptStore()
      let stored: ManuscriptV1 | null = null
      try {
        stored = await withTimeout(storeRef.current.load(migrated.projectId), 2000)
      } catch {
        // IndexedDB can be unavailable in private/restricted browser modes.
        // Continue in memory and surface the persistence limitation.
        setBootError('Lokalna pohrana nije dostupna; rukopis će trajati samo dok je ova kartica otvorena.')
      }
      if (cancelled) return
      const storage = getBrowserStorage()
      setComposerMaterials(readStoredComposerMaterials(storage, migrated.projectId))
      composerMaterialsHydratedRef.current = true
      const projectSetupConfirmed = readStorage(storage, `${PROJECT_SETUP_PREFIX}${migrated.projectId}`) === '1'
      const persistedMobileView = normalizeMobileView(readStorage(storage, `${MOBILE_VIEW_PREFIX}${migrated.projectId}`))
      const restoredManuscript = stored || migrated
      localManuscriptFoundRef.current = Boolean(stored)
      const persistedView = parseWorkspaceView(readStorage(storage, `${WORKSPACE_VIEW_PREFIX}${migrated.projectId}`))
      const persistedAgenticPhase = initialAgenticWorkspacePhase(readStorage(storage, `${AGENTIC_PHASE_PREFIX}${migrated.projectId}`))
      const persistedProjectMode = parseProjectMode(readStorage(storage, projectModeStorageKey(migrated.projectId)))
      const needsOnboarding = shouldShowManuscriptOnboarding({
        hasStoredManuscript: Boolean(stored),
        hasWorkspaceReadyMarker: readStorage(storage, `${READY_PREFIX}${migrated.projectId}`) === '1',
        hasLegacyOnboardingMarker: readStorage(storage, 'rp_onb') === '1',
        hasProjectSetupConfirmed: projectSetupConfirmed,
      })
      const unavailableAutonomousMode = persistedProjectMode === 'autonomous' && !agenticAvailable
      const restoredProjectMode = restoreProjectMode(persistedProjectMode, needsOnboarding, agenticAvailable)
      if (unavailableAutonomousMode) {
        setBootError('Autonomni workspace trenutno nije dostupan jer sigurni server-side agent ugovori nisu aktivni. Odaberi radionicu rukopisa ili pričekaj aktivaciju ugovora.')
      }
      const restoredView = initialWorkspaceView({ needsOnboarding, persistedView, projectMode: restoredProjectMode })
      setManuscript(restoredManuscript)
      setLegacyChecks(legacyState?.checks || {})
      setLektaSummary(readLektaSummary(manifest))
      setMentorTasks(readJson<MentorTask[]>(`${MENTOR_PREFIX}${migrated.projectId}`) || legacyState?.mentorTasks || [])
      setProjectMode(restoredProjectMode)
      setShowOnboarding(needsOnboarding)
      const modeView = restoredProjectMode ? projectModeWorkspaceView(restoredProjectMode) : null
      const shouldResumeAgentic = !needsOnboarding && restoredProjectMode === 'autonomous'
      const shouldResumeHome = !needsOnboarding && !modeView && !shouldResumeAgentic && (restoredView === 'home' || persistedMobileView === 'overview')
      const resumeState = normalizeWorkspaceResumeState({ projectHome: shouldResumeHome, mobileView: persistedMobileView })
      setMobileView(restoredProjectMode === 'autonomous' ? 'overview' : restoredProjectMode === 'manual' ? 'editor' : resumeState.mobileView)
      setProjectHome(restoredProjectMode ? false : resumeState.projectHome)
      if (resumeState.projectHome) writeStorage(storage, `${MOBILE_VIEW_PREFIX}${migrated.projectId}`, 'overview')
      setAgenticMode(restoredProjectMode === 'autonomous' || shouldResumeAgentic)
      setAgenticView(shouldResumeAgentic ? persistedAgenticPhase : 'preparation')
      setBooting(false)
    }
    void bootstrap().catch(() => {
      if (cancelled) return
      const identity = ensureGuestProjectIdentity()
      const fallback = migrateLegacyProject({ manifest: { projectId: identity.projectId || undefined, workType: 'z' } })
      setManuscript(fallback)
      setShowOnboarding(true)
      setBootError('Projektni podaci nisu se mogli učitati. Otvoren je novi lokalni rukopis.')
      setBooting(false)
    })
    return () => {
      cancelled = true
      aiRequestRef.current?.controller.abort()
      aiRequestRef.current = null
      void flushCurrentManuscript().catch(() => undefined).finally(() => storeRef.current?.close())
    }
  }, [agenticAvailable, flushCurrentManuscript])

  useEffect(() => {
    const projectId = manuscript?.projectId
    if (booting || authLoading || !user || !projectId || localManuscriptFoundRef.current || serverProjectHydratedRef.current === projectId) return
    serverProjectHydratedRef.current = projectId
    let cancelled = false
    const hydrate = async () => {
      try {
        const response = await fetch(`/api/state?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
        if (!response.ok) return
        const state = await response.json().catch(() => null)
        const manifest = serverStateToManifest(projectId, state)
        if (!manifest || cancelled) return
        const current = manuscriptRef.current
        if (!current || current.projectId !== projectId) return
        const hydrated = migrateLegacyProject({ manifest })
        const storage = getBrowserStorage()
        writeStorage(storage, `${READY_PREFIX}${projectId}`, '1')
        writeStorage(storage, `${PROJECT_SETUP_PREFIX}${projectId}`, '1')
        persistManifest(hydrated)
        setManuscript(hydrated)
        setShowOnboarding(false)
        setProjectHome(true)
      } catch {
        // The local-first workspace remains usable when server metadata is unavailable.
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [authLoading, booting, manuscript?.projectId, user])

  useEffect(() => {
    const autosave = autosaveRef.current
    if (!autosave) return
    if (!manuscript || showOnboarding || booting) {
      autosave.cancel()
      return
    }
    autosave.schedule(manuscript)
    return () => autosave.cancel()
  }, [booting, manuscript, showOnboarding])

  useEffect(() => {
    const handlePageHide = () => { void flushCurrentManuscript().catch(() => undefined) }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [flushCurrentManuscript])

  const syncProjectId = manuscript?.projectId
  const syncWorkType = manuscript?.workType
  const syncTitle = manuscript?.title || ''
  const syncDeadline = manuscript?.meta.deadline || ''
  const syncProfileId = manuscript?.meta.profileId || ''
  const syncUnitId = manuscript?.meta.unitId || ''
  const passContextReady = Boolean(syncProjectId && syncWorkType && user && !showOnboarding && !booting)
  const effectivePassStatus = passContextReady ? passStatus : 'idle'
  const passActive = effectivePassStatus === 'active' || effectivePassStatus === 'admin'
  const agenticPassActive = hasCanonicalAgenticPass(effectivePassStatus)
  const adminAutonomousOverride = effectivePassStatus === 'admin' && projectMode === 'autonomous'
  const effectiveProjectMode = adminAutonomousOverride ? null : projectMode
  const effectiveAgenticMode = adminAutonomousOverride ? false : agenticMode

  useEffect(() => {
    if (!adminAutonomousOverride || !manuscript) return
    const storage = getBrowserStorage()
    storage?.removeItem(projectModeStorageKey(manuscript.projectId))
    persistWorkspaceView(manuscript.projectId, 'writing')
  }, [adminAutonomousOverride, manuscript])

  useEffect(() => {
    if (!syncProjectId || !syncWorkType || !user || showOnboarding || booting) {
      return
    }
    let cancelled = false
    const refresh = async () => {
      setPassStatus('checking')
      setSyncStatus('syncing')
      const syncResult = await syncMetadata({
        projectId: syncProjectId,
        workType: syncWorkType,
        title: syncTitle,
        meta: { deadline: syncDeadline, profileId: syncProfileId, unitId: syncUnitId },
      }, true)
      if (cancelled) return
      setSyncStatus(syncResult.status)
      if (syncResult.status !== 'synced') {
        setPassStatus('error')
        return
      }
      try {
        const balanceProjectId = syncResult.canonicalProjectId || syncProjectId
        const response = await fetch(`/api/balance?projectId=${encodeURIComponent(balanceProjectId)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Pass check failed')
        const body = await response.json()
        if (!cancelled) setPassStatus(body.adminOverride ? 'admin' : body.hasPass ? 'active' : 'needed')
      } catch {
        if (!cancelled) setPassStatus('error')
      }
    }
    void refresh()
    return () => { cancelled = true }
  }, [booting, showOnboarding, syncDeadline, syncProfileId, syncProjectId, syncTitle, syncUnitId, syncWorkType, user])

  useEffect(() => {
    const current = manuscriptRef.current
    if (!current || booting || showOnboarding) return
    persistManifest(current)
  }, [booting, manuscript?.meta.citationStyle, manuscript?.meta.deadline, manuscript?.meta.institution, manuscript?.meta.mentor, manuscript?.meta.profileId, manuscript?.meta.program, manuscript?.meta.unitId, manuscript?.title, showOnboarding])

  useEffect(() => {
    const projectId = manuscript?.projectId
    if (!projectId || booting || !composerMaterialsHydratedRef.current) return
    writeStoredComposerMaterials(getBrowserStorage(), projectId, composerMaterials)
  }, [booting, composerMaterials, manuscript?.projectId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('placeno')
    if (!payment) return
    queueMicrotask(() => setCheckoutNotice(payment === '1' ? 'Plaćanje je zaprimljeno. Pass će se prikazati čim Stripe potvrdi aktivaciju.' : 'Plaćanje je prekinuto; rukopis je ostao netaknut.'))
    params.delete('placeno')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [])

  const updateManuscript = useCallback((recipe: (current: ManuscriptV1) => ManuscriptV1) => {
    setSaveStatus('saving')
    setManuscript((current) => current ? { ...recipe(current), updatedAt: new Date().toISOString() } : current)
  }, [])

  const activeSection = useMemo(() => manuscript?.sections.find((section) => section.id === manuscript.activeSectionId) || manuscript?.sections[0], [manuscript])
  useEffect(() => {
    activeSectionIdRef.current = activeSection?.id || null
  }, [activeSection?.id])
  const clearAiContext = useCallback(() => {
    aiRequestRef.current?.controller.abort()
    aiRequestRef.current = null
    setAssistantBusy(false)
    setAssistantError('')
    setProposal(null)
    setApplyRequest(null)
    setSelection(null)
  }, [])
  const visibleProposal = useMemo(() => {
    if (!proposal || !activeSection || proposal.sectionId !== activeSection.id) return null
    if (proposal.status !== 'ready') return proposal
    return canApplyProposal(proposal, activeSection.id, activeSection.content).ok
      ? proposal
      : { ...proposal, status: 'stale' as const }
  }, [activeSection, proposal])
  const onboardingInitialValues = useMemo<OnboardingInitialValues | undefined>(() => manuscript ? ({
    workType: manuscript.workType,
    institution: manuscript.meta.institution,
    program: manuscript.meta.program,
    unitId: manuscript.meta.unitId,
    profileId: manuscript.meta.profileId,
    title: manuscript.title,
    mentor: manuscript.meta.mentor,
    deadline: manuscript.meta.deadline,
    currentState: manuscript.meta.currentState,
    materials: manuscript.meta.materials,
  }) : undefined, [manuscript])

  const enterProjectOverview = (projectId: string) => {
    if (!projectId) return
    setDrawerOpen(false)
    setAgenticMode(false)
    setProjectHome(true)
    setMobileView('overview')
    const storage = getBrowserStorage()
    writeStorage(storage, `${MOBILE_VIEW_PREFIX}${projectId}`, 'overview')
    persistWorkspaceView(projectId, 'home')
  }

  const completeOnboarding = (result: OnboardingResult) => {
    if (!manuscript) return
    const next = migrateLegacyProject({
      manifest: {
        projectId: manuscript.projectId,
        topic: result.title,
        workType: result.workType,
        deadline: result.deadline,
        institution: result.institution,
        program: result.program,
        unitId: result.unitId,
        profileId: result.profileId,
      },
      legacyState: { gen: { f_fakultet: result.institution, f_smjer: result.program, f_mentor: result.mentor } },
    })
    const scan = createCompletionScan({
      startMode: result.startMode,
      currentState: result.currentState,
      title: result.title,
      importedText: result.importedText,
      mentor: result.mentor,
      deadline: result.deadline,
      materials: result.materials,
    })
    next.meta = { ...next.meta, currentState: result.currentState, materials: result.materials }
    if (result.importedText) next.sections[0].content = plainTextDocument(result.importedText)
    next.sections[0].status = result.importedText ? 'draft' : 'empty'
    const storage = getBrowserStorage()
    writeStorage(storage, `${READY_PREFIX}${next.projectId}`, '1')
    writeStorage(storage, `${PROJECT_SETUP_PREFIX}${next.projectId}`, '1')
    enterProjectOverview(next.projectId)
    persistManifest(next)
    setManuscript(next)
    setCompletionScan(scan)
    setShowOnboarding(false)
    void syncMetadata(next, Boolean(user)).then((result) => setSyncStatus(result.status))
  }

  const completeProjectMode = (mode: ProjectMode) => {
    if (!manuscript || !agenticPassActive) return
    const storage = getBrowserStorage()
    writeStorage(storage, projectModeStorageKey(manuscript.projectId), mode)
    setProjectMode(mode)
    setCompletionScan(null)
    setDrawerOpen(false)
    setProjectHome(false)
    setAgenticMode(mode === 'autonomous')
    setAgenticView('preparation')
    setMobileView(mode === 'autonomous' ? 'overview' : 'editor')
    persistWorkspaceView(manuscript.projectId, projectModeWorkspaceView(mode))
    persistAgenticWorkspacePhase(manuscript.projectId, 'preparation')
  }

  const updateSectionContent = (content: TiptapNode) => {
    if (!activeSection) return
    updateManuscript((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === activeSection.id ? {
        ...section,
        content,
        status: section.status === 'empty' && countDocumentWords(content) ? 'draft' : section.status,
        updatedAt: new Date().toISOString(),
      } : section),
    }))
  }

  const acceptAgenticDraft = async (draft: AgenticDraftV1, sectionIds?: string[]): Promise<boolean> => {
    if (!manuscript) return false
    const merged = mergeVerifiedAgenticSections({ manuscript, draft, sectionIds })
    if (merged.ok === false) {
      setAssistantError(merged.error)
      return false
    }
    try {
      await storeRef.current?.snapshot(manuscript, 'Prije prihvata verificiranog agenticnog rezultata')
      setManuscript(merged.manuscript)
      setSaveStatus('saving')
      clearAiContext()
      merged.acceptedSectionIds.forEach((sectionId) => appendProcessLog(manuscript.projectId, 'Verificirani agenticni rezultat', sectionId))
      return true
    } catch {
      setAssistantError('Verificirani rezultat nije moguće spremiti u lokalnu verziju.')
      return false
    }
  }

  const runAi = async (action: ManuscriptAiAction, instruction?: string) => {
    if (!manuscript || !activeSection || assistantBusy) return
    if (!user) {
      setAssistantError('Prijavi se kako bi Katedra mogla pripremiti AI prijedlog.')
      return
    }
    setAssistantError('')
    setAssistantBusy(true)
    const requestId = globalThis.crypto?.randomUUID?.() || `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    const controller = new AbortController()
    const requestSectionId = activeSection.id
    aiRequestRef.current?.controller.abort()
    aiRequestRef.current = { id: requestId, sectionId: requestSectionId, controller }
    const base = createAiProposal({
      sectionId: requestSectionId,
      action,
      baseContent: activeSection.content,
      proposedText: '',
      selectedFrom: selection?.from,
      selectedTo: selection?.to,
    })
    setProposal(base)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: buildAiMessages({ manuscript, sectionId: requestSectionId, action, selectionText: selection?.text, instruction, materialContext: composerMaterials }),
          projectId: manuscript.projectId,
          capability: capabilityForAction(action),
        }),
      })
      if (response.status === 402) setPassOpen(true)
      if (!response.ok || !response.body) throw new Error(await responseMessage(response))
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const parser = createTextDeltaParser()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!isCurrentAiRequest(requestId, aiRequestRef.current?.id || null, requestSectionId, activeSectionIdRef.current || '')) return
        full += parser.push(decoder.decode(value, { stream: true }))
        setProposal({ ...base, proposedText: full, status: 'streaming' })
      }
      if (!isCurrentAiRequest(requestId, aiRequestRef.current?.id || null, requestSectionId, activeSectionIdRef.current || '')) return
      full += parser.push(decoder.decode()) + parser.flush()
      if (!full.trim()) throw new Error('Katedra nije vratila tekst. Pokušaj ponovno.')
      setProposal({ ...base, proposedText: full.trim(), status: 'ready' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!isCurrentAiRequest(requestId, aiRequestRef.current?.id || null, requestSectionId, activeSectionIdRef.current || '')) return
      setProposal(null)
      setAssistantError(error instanceof Error ? error.message : 'AI prijedlog nije uspio.')
    } finally {
      if (aiRequestRef.current?.id === requestId) {
        aiRequestRef.current = null
        setAssistantBusy(false)
      }
    }
  }

  const applyProposal = async (mode: 'replace' | 'append') => {
    if (!proposal || !activeSection || proposal.status !== 'ready' || !manuscript) return
    const guard = canApplyProposal(proposal, activeSection.id, activeSection.content)
    if (guard.ok === false) {
      if (guard.reason === 'stale') setProposal({ ...proposal, status: 'stale' })
      else setProposal(null)
      setApplyRequest(null)
      return
    }
    try {
      await storeRef.current?.snapshot(manuscript, `AI prijedlog: ${proposal.action}`)
    } catch {
      setAssistantError('Prijedlog nije moguće spremiti u lokalnu verziju.')
      return
    }
    const target = proposalApplyTarget(proposal, mode, activeSection.content)
    if (!target) {
      setProposal({ ...proposal, status: 'stale' })
      return
    }
    setApplyRequest({
      id: proposal.id,
      sectionId: activeSection.id,
      mode: target.mode,
      text: proposal.proposedText,
      ...(target.from != null && target.to != null ? { from: target.from, to: target.to } : {}),
    })
  }

  const onApplied = (content: TiptapNode) => {
    if (!applyRequest || !activeSection || applyRequest.sectionId !== activeSection.id || proposal?.id !== applyRequest.id) {
      setApplyRequest(null)
      return
    }
    updateSectionContent(content)
    appendProcessLog(manuscript?.projectId || '', proposal?.action || 'AI prijedlog', activeSection?.id || '')
    setProposal((current) => current ? { ...current, status: 'accepted' } : current)
    setApplyRequest(null)
    setAcceptedFlash(true)
    setTimeout(() => { setAcceptedFlash(false); setProposal(null) }, 900)
  }

  const exportDocx = async () => {
    if (!manuscript) return
    try {
      await exportManuscriptDocx(manuscript)
      window.alert('DOCX je izrađen iz rukopisa, ali nije tehnički verificiran. Otvori ga u Wordu i provjeri u Lekti prije predaje.')
    } catch {
      window.alert('DOCX izvoz nije uspio. Lokalni rukopis ostao je sačuvan.')
    }
  }

  const importTextFile = async (file: File) => {
    if (!manuscript || !activeSection) return
    const fileValidation = validateTextImport(file)
    if (fileValidation.ok === false) {
      window.alert(fileValidation.reason === 'extension' ? 'Odaberi .txt ili .md datoteku.' : 'Odaberi .txt ili .md datoteku manju od 2 MB.')
      return
    }
    try {
      const text = await file.text()
      if (!validateImportedText(text).ok) {
      window.alert('Odabrana datoteka nema tekstualni sadržaj.')
      return
    }
      await storeRef.current?.snapshot(manuscript, `Uvoz teksta: ${file.name}`)
      clearAiContext()
      updateManuscript((current) => ({
        ...current,
        sections: current.sections.map((section) => section.id === activeSection.id ? {
          ...section,
          content: appendPlainText(section.content, text),
          status: 'draft',
          updatedAt: new Date().toISOString(),
        } : section),
      }))
    } catch {
      window.alert('Uvoz teksta nije uspio. Rukopis je ostao nepromijenjen.')
    }
  }

  const uploadComposerMaterial = async (file: File) => {
    if (!manuscript) return
    if (/\.(txt|md)$/i.test(file.name)) {
      const material = await readLocalTextMaterial(file)
      setComposerMaterials((current) => [...current.filter((entry) => entry.name !== material.name), material])
      return material
    }
    if (isDocxFile(file)) {
      const form = new FormData()
      form.set('file', file)
      const response = await fetch('/api/parse-docx', { method: 'POST', body: form }).catch(() => null)
      const body = await response?.json().catch(() => ({})) as Record<string, unknown> | undefined
      if (!response) throw new Error('DOCX trenutačno nije moguće pročitati zbog mrežne greške.')
      let material: ComposerMaterialV1
      if (response.ok && typeof body?.text === 'string') {
        material = {
          name: file.name,
          text: body.text,
          warnings: body.truncated === true ? ['Sadržaj je skraćen na 250.000 znakova za razgovor.'] : [],
          addedAt: new Date().toISOString(),
        }
      } else if (response.status === 401 || response.status === 503) {
        material = {
          ...createUnreadableMaterial(file),
          warnings: ['DOCX je dodan kao privitak, ali čitanje DOCX-a zahtijeva prijavu i aktivan analizator.'],
        }
      } else {
        throw new Error(typeof body?.error === 'string' ? body.error : 'DOCX nije moguće pročitati.')
      }
      setComposerMaterials((current) => [...current.filter((entry) => entry.name !== material.name), material])
      return material
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || file.type.startsWith('image/')) {
      const material = createUnreadableMaterial(file)
      setComposerMaterials((current) => [...current.filter((entry) => entry.name !== material.name), material])
      return material
    }
    const form = new FormData()
    form.set('projectId', manuscript.projectId)
    form.set('kind', 'notes')
    form.set('file', file)
    const response = await fetch('/api/materials', { method: 'POST', body: form }).catch(() => null)
    const body = await response?.json().catch(() => ({})) as Record<string, unknown> | undefined
    if (!response) throw new Error('Materijal trenutačno nije moguće učitati zbog mrežne greške.')
    if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Materijal nije moguće učitati.')
    const asset = body?.asset && typeof body.asset === 'object' ? body.asset as Record<string, unknown> : null
    const extractedText = typeof asset?.extractedText === 'string' ? asset.extractedText : undefined
    const warnings = Array.isArray(asset?.warnings) ? asset.warnings.filter((warning): warning is string => typeof warning === 'string') : []
    setComposerMaterials((current) => [
      ...current.filter((material) => material.name !== file.name),
      { name: typeof asset?.name === 'string' ? asset.name : file.name, text: extractedText, warnings },
    ])
  }

  if (booting || !manuscript) return <div className="pis-boot"><span className="pis-brand-mark">K</span><p>Otvaram tvoj rukopis…</p></div>
  if (showOnboarding) return <OnboardingFlow initialTip={initialTip} initialValues={onboardingInitialValues} scanMode={scanMode} onComplete={completeOnboarding} />
  if (completionScan) return <FreeProjectPlan projectId={manuscript.projectId} title={manuscript.title} scan={completionScan} authenticated={Boolean(user)} onContinue={() => setCompletionScan(null)} />
  if (agenticPassActive && !effectiveProjectMode) return <main className="pis-mode-gate"><ProjectModeOnboarding autonomousAvailable={agenticAvailable} onComplete={completeProjectMode} /></main>
  if (!activeSection) return null

  const workspaceView: WorkspaceView = projectHome ? 'home' : effectiveAgenticMode ? agenticView : 'writing'
  const drawerNavItem: ProjectNavItem = drawerTab === 'sources' || drawerTab === 'mentor' || drawerTab === 'lekta' || drawerTab === 'history' || drawerTab === 'defense'
    ? drawerTab
    : 'plan'
  const activeNavItem: ProjectNavItem = drawerOpen
    ? drawerNavItem
    : workspaceView === 'home'
    ? 'home'
    : effectiveAgenticMode
      ? 'studio'
      : 'writing'
  const selectAgenticPhase = (requestedPhase: AgenticWorkspacePhase) => {
    if (effectiveProjectMode === 'manual') return
    const nextPhase = nextAgenticWorkspacePhase(agenticView, requestedPhase)
    setDrawerOpen(false)
    setProjectHome(false)
    setAgenticMode(true)
    setAgenticView(nextPhase)
    persistWorkspaceView(manuscript.projectId, 'agents')
    persistAgenticWorkspacePhase(manuscript.projectId, nextPhase)
  }
  const navigateProject = (item: ProjectNavItem) => {
    if (effectiveProjectMode && !projectModeAllowsNavigation(effectiveProjectMode, item)) return
    const destination = projectNavigationDestination(item)
    if (destination.kind === 'home') {
      enterProjectOverview(manuscript.projectId)
      return
    }
    if (destination.kind === 'writing') {
      setDrawerOpen(false)
      setProjectHome(false)
      setAgenticMode(false)
      changeMobileView('editor')
      persistWorkspaceView(manuscript.projectId, 'writing')
      return
    }
    if (destination.kind === 'agentic') {
      selectAgenticPhase(destination.phase)
      return
    }
    if (destination.kind === 'agentic-review') {
      selectAgenticPhase('review')
      return
    }
    setDrawerTab(destination.tab)
    setDrawerOpen(true)
  }
  const navigateNextAction = (destination: 'writing' | 'preparation' | 'sources' | 'review' | 'lekta') => {
    if (destination === 'writing') {
      navigateProject('writing')
      return
    }
    if (destination === 'preparation') {
      if (!agenticPassActive) {
        setPassOpen(true)
        return
      }
      selectAgenticPhase('preparation')
      return
    }
    if (destination === 'review') {
      selectAgenticPhase('review')
      return
    }
    setDrawerTab(destination)
    setDrawerOpen(true)
  }

  const changeMobileView = (view: MobileView) => {
    const nextView = normalizeMobileView(view)
    if (nextView === 'overview') {
      enterProjectOverview(manuscript.projectId)
      return
    }

    setMobileView(nextView)
    writeStorage(getBrowserStorage(), `${MOBILE_VIEW_PREFIX}${manuscript.projectId}`, nextView)
    setProjectHome(false)
    setAgenticMode(false)
    persistWorkspaceView(manuscript.projectId, 'writing')
  }

  const openManuscriptSection = (sectionId: string) => {
    if (!manuscript.sections.some((section) => section.id === sectionId)) return
    clearAiContext()
    updateManuscript((current) => ({ ...current, activeSectionId: sectionId }))
    changeMobileView('editor')
  }

  const openAssistantForStep = (sectionId?: string) => {
    if (sectionId && manuscript.sections.some((section) => section.id === sectionId)) {
      clearAiContext()
      updateManuscript((current) => ({ ...current, activeSectionId: sectionId }))
    }
    changeMobileView('assistant')
  }

  return (
    <>
      {bootError && <div className="pis-storage-warning" role="status">{bootError}</div>}
      <WorkspaceShell
        manuscript={manuscript}
        saveStatus={saveStatus}
        syncStatus={syncStatus}
        activeMobileView={mobileView}
        onMobileViewChange={changeMobileView}
        onExport={() => void exportDocx()}
         onOpenTools={effectiveProjectMode === 'autonomous' ? undefined : () => setDrawerOpen(true)}
        activeNavItem={activeNavItem}
        onNavigate={navigateProject}
        workType={manuscript.workType}
        view={workspaceView}
         projectLocked={effectiveAgenticMode && agenticPassActive}
         projectMode={effectiveProjectMode}
         focusMode={focusMode}
        agenticContent={effectiveAgenticMode ? <AgentStudioShell manuscript={manuscript} passActive={agenticPassActive} phase={agenticView} onOpenWriting={effectiveProjectMode === 'autonomous' ? undefined : () => navigateProject('writing')}><PaidProjectSetup projectId={manuscript.projectId} passActive={agenticPassActive} sectionIds={manuscript.sections.map((section) => section.id)} manuscript={manuscript} requestedPhase={agenticView} onPhaseChange={selectAgenticPhase} onContextUpdated={(nextManuscript) => updateManuscript(() => nextManuscript)} onAcceptDraft={acceptAgenticDraft} onOpenSection={openManuscriptSection} onOpenAssistant={effectiveProjectMode === 'autonomous' ? undefined : openAssistantForStep} lockedMode={effectiveProjectMode === 'autonomous' ? 'autonomous' : undefined} webResearchAvailable={webResearchAvailable} /></AgentStudioShell> : undefined}
        projectHome={projectHome ? <ProjectHome manuscript={manuscript} passActive={passActive} syncStatus={syncStatus} onNavigate={navigateNextAction} /> : undefined}
        account={authLoading ? <span className="pis-account">Provjera računa…</span> : user ? (
          <div className="pis-account-group">
            <a className="pis-account" href="/racun">{user.email || 'Moj račun'}</a>
            <button type="button" className="pis-pass-status" data-state={effectivePassStatus} disabled={passActive || effectivePassStatus === 'checking'} onClick={() => setPassOpen(true)}>
              {effectivePassStatus === 'admin' ? 'Admin pristup' : effectivePassStatus === 'active' ? 'Pass aktivan' : effectivePassStatus === 'checking' ? 'Provjera Passa…' : 'Aktiviraj Pass'}
            </button>
          </div>
        ) : <a className="pis-account" href={`/prijava?redirect=${encodeURIComponent(buildProjectAuthRedirect(manuscript.projectId))}`}>Prijava</a>}
        outline={
          <OutlinePanel
            manuscript={manuscript}
             onActivate={(sectionId) => { clearAiContext(); updateManuscript((current) => ({ ...current, activeSectionId: sectionId })); changeMobileView('editor') }}
             onAdd={() => { clearAiContext(); updateManuscript((current) => { const section = createSection({ title: 'Novo poglavlje', order: current.sections.length }); return { ...current, sections: [...current.sections, section], activeSectionId: section.id } }) }}
             onMove={(sectionId, offset) => { clearAiContext(); updateManuscript((current) => { const index = current.sections.findIndex((section) => section.id === sectionId); return { ...current, sections: moveSection(current.sections, sectionId, index + offset) } }) }}
             onRemove={(sectionId) => { clearAiContext(); updateManuscript((current) => { const sections = removeSection(current.sections, sectionId); return { ...current, sections, activeSectionId: current.activeSectionId === sectionId ? sections[0].id : current.activeSectionId } }) }}
            onRename={(sectionId, title) => updateManuscript((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, title } : section) }))}
            onStatus={(sectionId, status: ManuscriptSectionStatus) => updateManuscript((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, status } : section) }))}
          />
        }
        editor={<>
          <WritingComposer sectionTitle={activeSection.title} selectionText={selection?.text} proposal={visibleProposal} busy={assistantBusy} materials={composerMaterials} onRun={(action, instruction) => void runAi(action, instruction)} onUpload={uploadComposerMaterial} onRemoveUpload={(name) => setComposerMaterials((current) => current.filter((material) => material.name !== name))} onAccept={() => void applyProposal('replace')} onInsert={() => void applyProposal('append')} onReject={() => { setProposal(null); setApplyRequest(null) }} onEdit={(text) => setProposal((current) => current ? { ...current, proposedText: text } : current)} />
          <ManuscriptEditor section={activeSection} acceptedFlash={acceptedFlash} onChange={updateSectionContent} onSelectionChange={setSelection} applyRequest={applyRequest} onApplied={onApplied} />
        </>}
         assistant={<AssistantPanel sectionTitle={activeSection.title} selectionText={selection?.text} proposal={visibleProposal} busy={assistantBusy} error={assistantError} initialTab="helpers" showProposal={false} showPrompt={false} onToggleFocus={() => setFocusMode((current) => !current)} onRun={(action, instruction) => void runAi(action, instruction)} onAccept={() => void applyProposal('replace')} onInsert={() => void applyProposal('append')} onReject={() => { setProposal(null); setApplyRequest(null) }} onEdit={(text) => setProposal((current) => current ? { ...current, proposedText: text } : current)} />}
      />
      <ProjectDrawer
        open={drawerOpen}
        manuscript={manuscript}
        legacyChecks={legacyChecks}
        mentorTasks={mentorTasks}
        lektaSummary={lektaSummary}
        passActive={agenticPassActive}
        onClose={() => setDrawerOpen(false)}
        onMetaChange={(field, value) => updateManuscript((current) => ({ ...current, meta: { ...current.meta, [field]: value } }))}
        onAddSource={(source: ManuscriptSourceV1) => updateManuscript((current) => ({ ...current, sources: [...current.sources, source] }))}
        onRemoveSource={(id) => updateManuscript((current) => ({ ...current, sources: current.sources.filter((source) => source.id !== id) }))}
        onAddMentorTask={(text) => { const next = [...mentorTasks, { id: `mentor-${Date.now().toString(36)}`, text, done: false, sectionId: activeSection.id }]; setMentorTasks(next); writeStorage(getBrowserStorage(), `${MENTOR_PREFIX}${manuscript.projectId}`, JSON.stringify(next)) }}
        onToggleMentorTask={(id) => { const next = mentorTasks.map((task) => task.id === id ? { ...task, done: !task.done } : task); setMentorTasks(next); writeStorage(getBrowserStorage(), `${MENTOR_PREFIX}${manuscript.projectId}`, JSON.stringify(next)) }}
        onBackup={() => downloadJson(manuscript)}
        onRestore={(file) => void (async () => {
          try {
            await storeRef.current?.snapshot(manuscript, 'Prije vraćanja backupa')
            const restored = await restoreJson(file, manuscript.projectId)
             clearAiContext()
             setManuscript(restored)
            setSaveStatus('saving')
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Backup nije valjan za ovaj projekt.')
          }
        })()}
        onImportText={(file) => void importTextFile(file)}
        onAcceptDraft={acceptAgenticDraft}
        requestedTab={drawerTab}
        onTabChange={setDrawerTab}
        historyEntries={(readJson<Array<{ occurredAt?: unknown; action?: unknown; sectionId?: unknown }>>(`katedra_manuscript_log:${manuscript.projectId}`) || []).flatMap((entry) => typeof entry.occurredAt === 'string' && typeof entry.action === 'string' && typeof entry.sectionId === 'string' ? [{ occurredAt: entry.occurredAt, action: entry.action, sectionId: entry.sectionId }] : [])}
      />
      {checkoutNotice && <div className="pis-checkout-notice" role="status"><span>{checkoutNotice}</span><button type="button" onClick={() => setCheckoutNotice('')} aria-label="Zatvori obavijest">×</button></div>}
      <PassDialog
        open={passOpen}
        projectId={manuscript.projectId}
        workType={manuscript.workType}
        projectTitle={manuscript.title}
        institution={manuscript.meta.institution}
        program={manuscript.meta.program}
        mentor={manuscript.meta.mentor}
        deadline={manuscript.meta.deadline}
        onClose={() => setPassOpen(false)}
      />
    </>
  )
}

function readJson<T>(key: string): T | null {
  try { return JSON.parse(readStorage(getBrowserStorage(), key) || 'null') as T | null } catch { return null }
}

function readLektaSummary(manifest: Record<string, unknown>): LektaWorkspaceSummary {
  const score = typeof manifest.lektaScore === 'number' ? manifest.lektaScore : null
  const issues = Array.isArray(manifest.lektaIssues)
    ? manifest.lektaIssues.filter((issue): issue is Record<string, unknown> => Boolean(issue && typeof issue === 'object')).map((issue) => ({
      id: String(issue.id || ''),
      label: typeof issue.label === 'string' ? issue.label : undefined,
      severity: typeof issue.severity === 'string' ? issue.severity : undefined,
      status: typeof issue.status === 'string' ? issue.status : undefined,
    })).filter((issue) => issue.id)
    : []
  return {
    score,
    checkedAt: typeof manifest.lektaCheckedAt === 'string' ? manifest.lektaCheckedAt : '',
    fixedTotal: typeof manifest.lektaFixedTotal === 'number' ? manifest.lektaFixedTotal : 0,
    issues,
  }
}

function persistManifest(manuscript: ManuscriptV1) {
  const previous = readJson<Record<string, unknown>>('rp_manifest') || {}
  writeStorage(getBrowserStorage(), 'rp_manifest', JSON.stringify({ ...previous, v: 1, projectId: manuscript.projectId, topic: manuscript.title, workType: manuscript.workType, institution: manuscript.meta.institution || '', program: manuscript.meta.program || '', mentor: manuscript.meta.mentor || '', citationStyle: manuscript.meta.citationStyle || '', unitId: manuscript.meta.unitId || '', profileId: manuscript.meta.profileId || '', deadline: manuscript.meta.deadline || '' }))
}

function persistWorkspaceView(projectId: string, view: WorkspaceViewPreference) {
  if (!projectId) return
  writeStorage(getBrowserStorage(), `${WORKSPACE_VIEW_PREFIX}${projectId}`, view)
}

function persistAgenticWorkspacePhase(projectId: string, phase: AgenticWorkspacePhase) {
  if (!projectId) return
  writeStorage(getBrowserStorage(), `${AGENTIC_PHASE_PREFIX}${projectId}`, phase)
}

async function responseMessage(response: Response): Promise<string> {
  const requestId = response.headers.get('x-request-id')
  const withReference = (message: string) => requestId ? `${message} Referenca: ${requestId}` : message
  try {
    const body = await response.json()
    if (response.status === 401) return withReference('Prijavi se za korištenje Katedrina urednika.')
    if (response.status === 402) return withReference(body.reason === 'cap-reached' ? 'Dosegnut je sigurnosni limit projekta. Javi se podršci.' : 'Aktiviraj Pass za ovaj projekt.')
    if (response.status === 403) return withReference(body.error || 'AI politika ustanove dopušta samo vođenje pitanjima.')
    if (response.status === 429) return withReference(body.error || 'Pričekaj završetak prethodnog odgovora.')
    return withReference(body.error || 'Katedra trenutačno nije dostupna.')
  } catch { return withReference('Katedra trenutačno nije dostupna.') }
}

function appendProcessLog(projectId: string, action: string, sectionId: string) {
  const key = `katedra_manuscript_log:${projectId}`
  const current = readJson<Array<Record<string, unknown>>>(key) || []
  current.push({ occurredAt: new Date().toISOString(), kind: 'ai_proposal_accepted', action, sectionId, userApproved: true })
  writeStorage(getBrowserStorage(), key, JSON.stringify(current.slice(-200)))
}

function downloadJson(manuscript: ManuscriptV1) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(manuscript, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `katedra-backup-${manuscript.projectId}.json`; anchor.click(); URL.revokeObjectURL(url)
}

async function restoreJson(file: File, projectId: string): Promise<ManuscriptV1> {
  if (file.size > 5_000_000) throw new Error('Backup je prevelik (najviše 5 MB).')
  const value = JSON.parse(await file.text()) as ManuscriptV1
  const result = validateManuscriptBackup(value, projectId)
  if (result.ok === false) throw new Error(result.error)
  return { ...result.value, updatedAt: new Date().toISOString() }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('Local storage timeout')), timeoutMs)),
  ])
}
