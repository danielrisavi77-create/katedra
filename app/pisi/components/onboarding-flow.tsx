'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { createAcademicCatalog, displayAcademicProfile, findAcademicUnits, findProfilesForUnit, resolveUniqueAcademicUnit, type AcademicCatalog, type AcademicProfile, type AcademicUnit } from '../../../lib/manuscript/academic-catalog'
import type { ProjectCurrentState } from '../../../lib/project/completion-scan'
import type { LegacyWorkType } from '../../../lib/manuscript/types'
import { ThemeToggle } from '../../theme-toggle'

export type OnboardingResult = {
  startMode: 'new' | 'existing'
  workType: LegacyWorkType
  institution: string
  program: string
  unitId: string
  profileId: string
  title: string
  mentor: string
  deadline: string
  importedText: string
  currentState: ProjectCurrentState
  materials: string[]
}

export type OnboardingInitialValues = Partial<Pick<OnboardingResult, 'workType' | 'institution' | 'program' | 'unitId' | 'profileId' | 'title' | 'mentor' | 'deadline' | 'currentState' | 'materials'>>

export function OnboardingFlow({
  initialTip,
  initialValues,
  scanMode = false,
  onComplete,
}: {
  initialTip?: LegacyWorkType
  initialValues?: OnboardingInitialValues
  scanMode?: boolean
  onComplete: (result: OnboardingResult) => void
}) {
  const [step, setStep] = useState(scanMode ? 3 : 1)
  const [startMode, setStartMode] = useState<'new' | 'existing' | null>(scanMode ? 'existing' : null)
  const [workType, setWorkType] = useState<LegacyWorkType>(initialTip || initialValues?.workType || 'z')
  const [institution, setInstitution] = useState(initialValues?.institution || '')
  const [program, setProgram] = useState(initialValues?.program || '')
  const [unitId, setUnitId] = useState(initialValues?.unitId || '')
  const [profileId, setProfileId] = useState(initialValues?.profileId || '')
  const [catalog, setCatalog] = useState<AcademicCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [title, setTitle] = useState(initialValues?.title || '')
  const [mentor, setMentor] = useState(initialValues?.mentor || '')
  const [deadline, setDeadline] = useState(initialValues?.deadline || '')
  const [importedText, setImportedText] = useState('')
  const [currentState, setCurrentState] = useState<ProjectCurrentState>(initialValues?.currentState || 'no_topic')
  const [materials, setMaterials] = useState<string[]>(initialValues?.materials || [])

  useEffect(() => {
    let active = true
    void fetch('/katedra-pack.json', { cache: 'force-cache' })
      .then(async (response) => response.ok ? createAcademicCatalog(await response.json()) : null)
      .then((value) => { if (active) setCatalog(value) })
      .catch(() => { if (active) setCatalog(null) })
      .finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [])

  const facultyOptions = useMemo(() => catalog ? findAcademicUnits(catalog, institution) : [], [catalog, institution])
  const inferredUnit = useMemo(() => catalog && !unitId ? resolveUniqueAcademicUnit(catalog, institution) : null, [catalog, institution, unitId])
  const activeUnitId = unitId || inferredUnit?.id || ''
  const programOptions = useMemo(() => catalog && activeUnitId ? findProfilesForUnit(catalog, activeUnitId, workType, program) : [], [activeUnitId, catalog, program, workType])

  const selectFaculty = (unit: AcademicUnit) => {
    setInstitution(unit.name)
    setUnitId(unit.id)
    setProgram('')
    setProfileId('')
  }

  const changeFaculty = (value: string) => {
    const resolved = catalog ? resolveUniqueAcademicUnit(catalog, value) : null
    setInstitution(resolved?.name || value)
    setUnitId(resolved?.id || '')
    setProgram('')
    setProfileId('')
  }

  const selectProgram = (profile: AcademicProfile) => {
    setProgram(profile.label)
    setProfileId(profile.id)
  }

  const changeWorkType = (value: LegacyWorkType) => {
    setWorkType(value)
    setProgram('')
    setProfileId('')
  }

  const chooseStart = (value: 'new' | 'existing') => {
    setStartMode(value)
    if (value === 'existing' && currentState === 'no_topic') setCurrentState('draft')
    setStep(2)
  }

  const finish = () => {
    onComplete({
      startMode: startMode || 'new',
      workType,
      institution: (inferredUnit?.name || institution).trim(),
      program: program.trim(),
      unitId: activeUnitId,
      profileId,
      title: title.trim(),
      mentor: mentor.trim(),
      deadline,
      importedText: importedText.trim(),
      currentState,
      materials,
    })
  }

  return (
    <div className="pis-onboarding">
      <header className="pis-onboarding-brand">
        <span className="pis-onboarding-brand-name"><span className="pis-brand-mark" aria-hidden="true">K</span><span>Katedra</span></span>
        <ThemeToggle />
      </header>

      <div className="pis-onboarding-progress" aria-label={`Korak ${step} od 5`}>
        <span>0{step}</span>
        <i><b style={{ width: `${step * 20}%` }} /></i>
        <span>05</span>
      </div>

      {step === 1 && (
        <section className="pis-onboarding-step" aria-labelledby="onboarding-title-1">
          <p className="pis-kicker">Radionica rukopisa</p>
          <h1 id="onboarding-title-1">Od čega krećemo?</h1>
          <p className="pis-onboarding-lead">Otvori prazan rukopis ili donesi tekst koji već postoji. Katedra će ti pomoći da ga gradiš poglavlje po poglavlje.</p>
          <div className="pis-choice-lines">
            <button type="button" onClick={() => chooseStart('new')}>
              <span>01</span><b>Novi rad</b><small>Počni od teme, plana i prvog poglavlja.</small><em>→</em>
            </button>
            <button type="button" onClick={() => chooseStart('existing')}>
              <span>02</span><b>Imam tekst</b><small>Zalijepi postojeći nacrt i nastavi ga uređivati.</small><em>→</em>
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="pis-onboarding-step" aria-labelledby="onboarding-title-2">
          <p className="pis-kicker">Okvir rada</p>
          <h1 id="onboarding-title-2">Što pišeš i gdje?</h1>
          <fieldset className="pis-type-fieldset">
            <legend>Vrsta rada</legend>
            <div className="pis-type-lines">
              {([['s', 'Seminarski'], ['z', 'Završni'], ['d', 'Diplomski']] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={workType === value ? 'is-active' : ''}
                  onClick={() => changeWorkType(value)}
                >
                  {label}<span>{workType === value ? 'Odabrano' : 'Odaberi'}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <CatalogCombobox
            label="Fakultet ili ustanova"
            value={institution}
            placeholder="Upiši naziv ili kraticu, npr. FPZG"
            options={facultyOptions}
            loading={catalogLoading}
            emptyMessage="Nema podudaranja. Možeš zadržati vlastiti unos."
            optionLabel={(unit) => unit.name}
            optionDetail={(unit) => unit.inst}
            onChange={changeFaculty}
            onSelect={selectFaculty}
          />
          <CatalogCombobox
            label="Smjer / studij"
            value={program}
            placeholder={activeUnitId ? 'Odaberi ili upiši smjer / studij' : 'Upiši smjer / studij (nije obavezno)'}
            options={programOptions}
            loading={catalogLoading && Boolean(unitId)}
            emptyMessage="Za ovu vrstu rada nema profila u katalogu. Možeš ga upisati ručno."
            optionLabel={displayAcademicProfile}
            onChange={(value) => { setProgram(value); setProfileId('') }}
            onSelect={selectProgram}
          />
          <p className="pis-catalog-note">Možeš upisati puni naziv, dio naziva ili kraticu. Ako fakultet nije na popisu, nastavi sa slobodnim unosom.</p>
          <div className="pis-onboarding-actions">
            <button type="button" className="pis-text-button" onClick={() => setStep(1)}>← Natrag</button>
            <button type="button" className="pis-primary-button" onClick={() => setStep(3)}>Dalje →</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="pis-onboarding-step" aria-labelledby="onboarding-title-3">
          <p className="pis-kicker">Početno stanje</p>
          <h1 id="onboarding-title-3">Koliko je rad već odmakao?</h1>
          <p className="pis-onboarding-lead">Ovo nije ocjena rada. Katedri samo pomaže da ti pokaže pravi sljedeći korak.</p>
          <fieldset className="pis-type-fieldset">
            <legend>Trenutno stanje</legend>
            <div className="pis-type-lines">
              {([
                ['no_topic', 'Još nemam temu'],
                ['topic', 'Imam temu'],
                ['outline', 'Imam plan ili sadržaj'],
                ['draft', 'Pišem nacrt'],
                ['review', 'Rad je na reviziji'],
              ] as const).map(([value, label]) => (
                <button type="button" key={value} className={currentState === value ? 'is-active' : ''} onClick={() => setCurrentState(value)}>
                  {label}<span>{currentState === value ? 'Odabrano' : 'Odaberi'}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="pis-type-fieldset">
            <legend>Što već imaš?</legend>
            <div className="pis-type-lines">
              {([
                ['draft', 'Svoj nacrt'],
                ['sources', 'Literaturu ili izvore'],
                ['mentor', 'Upute mentora'],
                ['rules', 'Pravila fakulteta'],
              ] as const).map(([value, label]) => {
                const selected = materials.includes(value)
                return <button type="button" key={value} className={selected ? 'is-active' : ''} onClick={() => setMaterials((current) => selected ? current.filter((item) => item !== value) : [...current, value])}>{label}<span>{selected ? 'Odabrano' : 'Dodaj'}</span></button>
              })}
            </div>
          </fieldset>
          <div className="pis-onboarding-actions">
            <button type="button" className="pis-text-button" onClick={() => setStep(2)}>← Natrag</button>
            <button type="button" className="pis-primary-button" onClick={() => setStep(4)}>Dalje →</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="pis-onboarding-step" aria-labelledby="onboarding-title-3">
          <p className="pis-kicker">Projekt</p>
          <h1 id="onboarding-title-3">Daj rukopisu početni oblik.</h1>
          <label className="pis-field">
            <span>Tema rada</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Može ostati radni naslov" />
          </label>
          {startMode === 'existing' && (
            <label className="pis-field">
              <span>Postojeći tekst</span>
              <textarea value={importedText} onChange={(event) => setImportedText(event.target.value)} rows={8} placeholder="Zalijepi tekst ili ga kasnije uvezi iz .txt/.md datoteke." />
              <small>Za tehničku provjeru izvornog DOCX-a koristi Lektu.</small>
            </label>
          )}
          <div className="pis-two-fields">
            <label className="pis-field">
              <span>Mentor</span>
              <input value={mentor} onChange={(event) => setMentor(event.target.value)} placeholder="Možeš dodati poslije" />
            </label>
            <label className="pis-field">
              <span>Rok predaje</span>
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </label>
          </div>
          <div className="pis-onboarding-actions">
            <button type="button" className="pis-text-button" onClick={() => setStep(3)}>← Natrag</button>
            <button type="button" className="pis-primary-button" onClick={() => setStep(5)}>Dalje →</button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="pis-onboarding-step" aria-labelledby="onboarding-title-5">
          <p className="pis-kicker">Sažetak projekta</p>
          <h1 id="onboarding-title-5">Spremni smo za prvi sljedeći korak.</h1>
          <dl className="pis-onboarding-summary">
            <div><dt>Vrsta rada</dt><dd>{workType === 's' ? 'Seminarski' : workType === 'z' ? 'Završni' : 'Diplomski'}</dd></div>
            <div><dt>Fakultet</dt><dd>{(inferredUnit?.name || institution) || 'Nije odabrano'}</dd></div>
            <div><dt>Tema</dt><dd>{title || 'Još nije definirana'}</dd></div>
            <div><dt>Početno stanje</dt><dd>{currentState === 'no_topic' ? 'Još nemam temu' : currentState === 'topic' ? 'Imam temu' : currentState === 'outline' ? 'Imam plan ili sadržaj' : currentState === 'draft' ? 'Pišem nacrt' : 'Rad je na reviziji'}</dd></div>
          </dl>
          <p className="pis-onboarding-lead">Nakon otvaranja dobit ćeš lokalni Completion Scan i tri preporučena sljedeća koraka.</p>
          <div className="pis-onboarding-actions">
            <button type="button" className="pis-text-button" onClick={() => setStep(4)}>← Natrag</button>
            <button type="button" className="pis-primary-button" onClick={finish}>Otvori projekt →</button>
          </div>
        </section>
      )}
    </div>
  )
}

function CatalogCombobox<T extends { id: string }>({
  label,
  value,
  placeholder,
  options,
  loading,
  emptyMessage,
  disabled = false,
  optionLabel,
  optionDetail,
  onChange,
  onSelect,
}: {
  label: string
  value: string
  placeholder: string
  options: T[]
  loading: boolean
  emptyMessage: string
  disabled?: boolean
  optionLabel: (option: T) => string
  optionDetail?: (option: T) => string
  onChange: (value: string) => void
  onSelect: (option: T) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputId = useId()
  const listId = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const hasOptions = options.length > 0

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const chooseOption = (option: T) => {
    onSelect(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => hasOptions ? Math.min(current < 0 ? 0 : current + 1, options.length - 1) : -1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => hasOptions ? Math.max(current < 0 ? options.length - 1 : current - 1, 0) : -1)
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault()
      chooseOption(options[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={fieldRef} className="pis-field pis-catalog-field">
      <span id={`${inputId}-label`}>{label}</span>
      <div className="pis-catalog-control">
        <input
          id={inputId}
          role="combobox"
          aria-labelledby={`${inputId}-label`}
          aria-controls={listId}
          aria-expanded={open && !disabled}
          aria-activedescendant={open && activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          value={value}
          disabled={disabled}
          onFocus={() => { setOpen(true); setActiveIndex(-1) }}
          onKeyDown={handleKeyDown}
          onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1) }}
          placeholder={placeholder}
        />
        <button type="button" aria-label="Prikaži prijedloge" disabled={disabled} onClick={() => setOpen((current) => !current)}>⌄</button>
      </div>
      {open && !disabled && (
        <div id={listId} className="pis-catalog-menu" role="listbox" aria-label={`${label} prijedlozi`}>
          {loading && <p>Učitavam katalog…</p>}
          {!loading && hasOptions && options.map((option, index) => (
            <button id={`${inputId}-option-${index}`} key={option.id} type="button" role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseOption(option)}>
              <b>{optionLabel(option)}</b>
              {optionDetail?.(option) && <small>{optionDetail(option)}</small>}
            </button>
          ))}
          {!loading && !hasOptions && <p>{emptyMessage}</p>}
        </div>
      )}
    </div>
  )
}
