/**
 * Pure console rules (D09, D16, D19, D20, 03 §5.11). The BFF re-checks every
 * one of them; the console shows them as checklists so root sees why an action
 * is disabled before trying it.
 */
import type {
    AcceptanceScores,
    AcceptanceVerdict,
    AdminCatalogVoice,
    LibraryVoice,
    VoiceDefaultRole,
    VoiceDefaultRow,
    VoiceVisibility,
} from '@/shared'
import {
    CALL_ELIGIBLE_MIN_CONSISTENCY,
    CURATED_LANGUAGES,
    DEFAULT_ELIGIBLE_SOURCE_KINDS,
    EXPRESSIVE_MODEL_ID,
    FALLBACK_POOL_MIN,
    STANDARD_MODEL_ID,
    HEARD_SOURCE_KINDS,
    LIBRARY_MIN_NOTICE_DAYS,
    LIBRARY_PUBLIC_USE_CONFIRMED,
    LIBRARY_REMIX_RULE_CONFIRMED,
    LIBRARY_SOURCE_KINDS,
    LIGHT_LANGUAGES,
    MAX_ATTENUATION_DB,
    OWNED_SOURCE_KINDS,
    TARGET_LUFS,
} from './constants'

/** One checklist row: an i18n key (+ values) and whether it passes. */
export interface RuleCheck {
    id: string
    passed: boolean
    labelKey: string
    labelValues?: Record<string, string | number>
    /** Extra reason shown next to a failing row. */
    noteKey?: string
}

export const allPassed = (checks: readonly RuleCheck[]) => checks.every((check) => check.passed)
export const firstFailure = (checks: readonly RuleCheck[]) => checks.find((check) => !check.passed) ?? null

// ---- Acceptance facts ----

export function isAccepted(voice: AdminCatalogVoice, modelId: string, language: string): boolean {
    return voice.acceptance.some((row) => row.model_id === modelId && row.language === language && row.verdict === 'pass')
}

/** Languages accepted on the given model (v4 by default). */
export function acceptedLanguages(voice: AdminCatalogVoice, modelId: string = STANDARD_MODEL_ID): string[] {
    const languages = new Set<string>()
    for (const row of voice.acceptance) {
        if (row.model_id === modelId && row.verdict === 'pass') languages.add(row.language)
    }
    return [...languages].sort()
}

export function sampleUrl(voice: AdminCatalogVoice, language: string): string | null {
    return voice.languages.find((entry) => entry.language === language)?.sample_url ?? null
}

export function hasSample(voice: AdminCatalogVoice, language: string): boolean {
    return Boolean(sampleUrl(voice, language))
}

/** `consistency_vs_v4` of the v4 row in `language`, or null without one. */
export function flashConsistency(voice: AdminCatalogVoice, language: string): number | null {
    const row = voice.acceptance.find((entry) => entry.model_id === STANDARD_MODEL_ID && entry.language === language)
    const score = row?.scores?.consistency_vs_v4
    return typeof score === 'number' && Number.isFinite(score) ? score : null
}

export const isOwnedVoice = (voice: Pick<AdminCatalogVoice, 'source_kind'>) => OWNED_SOURCE_KINDS.has(voice.source_kind)
export const isLibraryVoice = (voice: Pick<AdminCatalogVoice, 'source_kind'>) => LIBRARY_SOURCE_KINDS.has(voice.source_kind)

/** Published = pickable by users: active and not root-only. */
export function isPublished(voice: Pick<AdminCatalogVoice, 'status' | 'visibility'>): boolean {
    return voice.status === 'active' && voice.visibility !== 'admin'
}

// ---- Publish checklist (05 §8.3; the BFF's `publish_blockers`, 04 §5.3 I-2 with P-13) ----

export interface PublishContext {
    /** The visibility being published to. */
    visibility: Exclude<VoiceVisibility, 'admin'>
    /**
     * The stored replacement's catalog row, when the console has it loaded. Without
     * it (not in the loaded pages) the row is unknown and only its presence is checked.
     */
    replacement?: AdminCatalogVoice
}

/** Why the source kind cannot be published yet (the BFF's source codes, as i18n notes); undefined when it can. */
function sourceNoteKey(voice: AdminCatalogVoice): string | undefined {
    if (voice.source_kind === 'premade_deprecated') return 'admin.voices.catalog.publishChecklist.premade'
    if (isLibraryVoice(voice) || voice.source_kind === 'pvc_shared') {
        return LIBRARY_PUBLIC_USE_CONFIRMED ? undefined : 'admin.voices.catalog.publishChecklist.blockedUntilL2'
    }
    if (voice.source_kind === 'ivc') return 'admin.voices.catalog.publishChecklist.ivcBlocked'
    return HEARD_SOURCE_KINDS.has(voice.source_kind) ? undefined : 'admin.voices.catalog.publishChecklist.sourceNotAllowed'
}

/** The replacement row: set, and (when its catalog row is loaded) still valid by the BFF's `replacement_problem`. */
function replacementCheck(voice: AdminCatalogVoice, replacement: AdminCatalogVoice | undefined): RuleCheck {
    const labelKey = 'admin.voices.catalog.publishChecklist.replacement'
    if (!voice.replacement_voice_key) return { id: 'replacement', passed: false, labelKey }
    const problem = replacement && replacement.voice_key === voice.replacement_voice_key ? replacementProblem(voice, replacement) : null
    return problem
        ? { id: 'replacement', passed: false, labelKey, noteKey: `admin.voices.publishFailures.${problem}` }
        : { id: 'replacement', passed: true, labelKey }
}

/**
 * The publish rules the console can check from the row. The BFF also checks what
 * the row cannot show (an Expressive showcase per language, a replacement outside
 * the loaded pages) and answers 422 `publish_precondition_failed` with `failed`
 * codes, which the drawer lists (`publishFailures`).
 */
export function publishChecklist(voice: AdminCatalogVoice, context: PublishContext): RuleCheck[] {
    if (voice.provider === 'fish_audio') {
        const languages = voice.acceptance.filter((row) => ['drama-3', 's2.1-pro'].includes(row.model_id) && row.verdict === 'pass').map((row) => row.language)
        return [
            { id: 'fishAccepted', passed: languages.length > 0, labelKey: 'admin.voices.fish.accepted' },
            { id: 'samples', passed: languages.length > 0 && languages.every((language) => hasSample(voice, language)), labelKey: 'admin.voices.catalog.publishChecklist.samples' },
            { id: 'sourceKind', passed: ['owned_reference', 'licensed_reference', 'designed'].includes(voice.source_kind), labelKey: 'admin.voices.fish.source' },
            ...(context.visibility === 'plan_gated' ? [{ id: 'minPlan', passed: Boolean(voice.min_plan?.trim()), labelKey: 'admin.voices.catalog.publishChecklist.minPlan' }] : []),
        ]
    }
    const flashLanguages = acceptedLanguages(voice)
    const missingSamples = flashLanguages.filter((language) => !hasSample(voice, language))
    const missingExpressive = flashLanguages.filter((language) => !isAccepted(voice, EXPRESSIVE_MODEL_ID, language))
    const lowConsistency = flashLanguages.filter((language) => (flashConsistency(voice, language) ?? 0) < CALL_ELIGIBLE_MIN_CONSISTENCY)
    const sourceNote = sourceNoteKey(voice)
    const checks: RuleCheck[] = [
        { id: 'flashAccepted', passed: flashLanguages.length > 0, labelKey: 'admin.voices.catalog.publishChecklist.flashAccepted' },
        {
            id: 'expressiveAccepted',
            passed: flashLanguages.length > 0 && missingExpressive.length === 0,
            labelKey: 'admin.voices.catalog.publishChecklist.expressiveAccepted',
        },
        {
            id: 'callConsistency',
            passed: flashLanguages.length > 0 && lowConsistency.length === 0,
            labelKey: 'admin.voices.catalog.publishChecklist.callConsistency',
            labelValues: { min: CALL_ELIGIBLE_MIN_CONSISTENCY },
        },
        { id: 'callEligible', passed: voice.call_eligible, labelKey: 'admin.voices.catalog.publishChecklist.callEligible' },
        {
            id: 'samples',
            passed: flashLanguages.length > 0 && missingSamples.length === 0,
            labelKey: 'admin.voices.catalog.publishChecklist.samples',
        },
        replacementCheck(voice, context.replacement),
        {
            id: 'sourceKind',
            passed: sourceNote === undefined,
            labelKey: 'admin.voices.catalog.publishChecklist.sourceKind',
            noteKey: sourceNote,
        },
    ]
    if (context.visibility === 'plan_gated') {
        checks.push({ id: 'minPlan', passed: Boolean(voice.min_plan?.trim()), labelKey: 'admin.voices.catalog.publishChecklist.minPlan' })
    }
    return checks
}

/** Library kinds are publish-blocked until L-2 (05 §8.7). */
export function isBlockedUntilL2(voice: Pick<AdminCatalogVoice, 'source_kind'>): boolean {
    return isLibraryVoice(voice) && !LIBRARY_PUBLIC_USE_CONFIRMED
}

// ---- Provider delete (D19) ----

/** Library copies and other non-owned kinds never offer a provider delete. */
export const offersProviderDelete = isOwnedVoice

export function providerDeleteBlockers(voice: AdminCatalogVoice): RuleCheck[] {
    return [
        { id: 'owned', passed: isOwnedVoice(voice), labelKey: 'admin.voices.catalog.delete.notOwned' },
        {
            id: 'references',
            passed: voice.reference_count === 0,
            labelKey: 'admin.voices.catalog.delete.hasReferences',
            labelValues: { count: voice.reference_count },
        },
        {
            id: 'status',
            passed: voice.status !== 'deprecating' && voice.status !== 'removed',
            labelKey: 'admin.voices.catalog.delete.badStatus',
        },
    ]
}

// ---- Acceptance (D09, D16, I-15) ----

const hasLufs = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value)

/** `gain_db = min(0, −18 − integrated_lufs)`, rounded to 0.1 dB for display. Attenuation only (I-15). */
export function computeGainDb(integratedLufs: number | null | undefined): number | null {
    if (!hasLufs(integratedLufs)) return null
    const gain = Math.min(0, TARGET_LUFS - integratedLufs)
    const rounded = Math.round(gain * 10) / 10
    return rounded === 0 ? 0 : rounded
}

/**
 * The loudest integrated loudness a pass accepts: −18 − (−6) = −12 LUFS. Copy states
 * the limit in LUFS, which needs no rounding, so it never contradicts the gain shown.
 */
export const MAX_PASS_LUFS = TARGET_LUFS - MAX_ATTENUATION_DB

/** The server rule on the unrounded gain: more than −6 dB of attenuation (422 `gain_out_of_range`). */
export function exceedsAttenuation(integratedLufs: number | null | undefined): boolean {
    return hasLufs(integratedLufs) && Math.min(0, TARGET_LUFS - integratedLufs) < MAX_ATTENUATION_DB
}

export interface LoudnessFlags {
    gainDb: number | null
    /** Needs more than −6 dB of attenuation: a pass is refused (I-15). */
    tooLoud: boolean
    /** Quieter than the target: the gain cannot raise it. */
    tooQuiet: boolean
}

export function loudnessFlags(integratedLufs: number | null | undefined): LoudnessFlags {
    const gainDb = computeGainDb(integratedLufs)
    return {
        gainDb,
        tooLoud: exceedsAttenuation(integratedLufs),
        tooQuiet: gainDb !== null && (integratedLufs as number) < TARGET_LUFS,
    }
}

/** Why a verdict cannot be sent yet; matches the server's refusal where one exists. */
export type VerdictBlocker = 'lufs_required' | 'gain_out_of_range'

/**
 * I-15: a pass carries the offline-meter loudness (so the stored `gain_db` is
 * known), and a pass that needs more than −6 dB is refused, as the BFF does with
 * 422 `gain_out_of_range` (D16). A fail is never blocked.
 */
export function verdictBlocker(verdict: AcceptanceVerdict | null, integratedLufs: number | null | undefined): VerdictBlocker | null {
    if (verdict !== 'pass') return null
    if (!hasLufs(integratedLufs)) return 'lufs_required'
    return exceedsAttenuation(integratedLufs) ? 'gain_out_of_range' : null
}

/** D09: call eligible only with a v4 pass and consistency ≥ 4. */
export function callEligibleFrom(modelId: string, verdict: AcceptanceVerdict | null, scores: Partial<AcceptanceScores>): boolean {
    return modelId === STANDARD_MODEL_ID && verdict === 'pass' && (scores.consistency_vs_v4 ?? 0) >= CALL_ELIGIBLE_MIN_CONSISTENCY
}

// ---- Remix (05 §8.9) ----

export interface RemixEligibility {
    eligible: boolean
    reasonKey: string | null
}

export function remixEligibility(voice: AdminCatalogVoice): RemixEligibility {
    if (voice.provider === 'fish_audio') return { eligible: false, reasonKey: 'admin.voices.fish.remixUnavailable' }
    if (voice.status === 'removed' || voice.status === 'blocked') return { eligible: false, reasonKey: 'admin.voices.remix.unavailable' }
    if (voice.source_kind === 'designed' || voice.source_kind === 'remixed') return { eligible: true, reasonKey: null }
    // IVC needs a consent scope covering derivatives (proposed; LEGAL).
    if (voice.source_kind === 'ivc') return { eligible: false, reasonKey: 'admin.voices.remix.ivcBlocked' }
    if (isLibraryVoice(voice)) {
        const mixingAllowed = voice.terms_at_add?.voice_mixing_allowed === true
        // Finite-notice Library voices are not remixable.
        const perpetual = voice.source_kind === 'library_perpetual'
        if (LIBRARY_REMIX_RULE_CONFIRMED && mixingAllowed && perpetual) return { eligible: true, reasonKey: null }
        return { eligible: false, reasonKey: 'admin.voices.remix.libraryRuleBlocked' }
    }
    return { eligible: false, reasonKey: 'admin.voices.remix.notOwned' }
}

// ---- Defaults readiness (03 §5.11) ----

export function readinessChecks(voice: AdminCatalogVoice, language: string, languageName: string): RuleCheck[] {
    return [
        { id: 'sourceKind', passed: DEFAULT_ELIGIBLE_SOURCE_KINDS.has(voice.source_kind), labelKey: 'admin.voices.defaults.readiness.sourceKind' },
        { id: 'active', passed: voice.status === 'active', labelKey: 'admin.voices.defaults.readiness.active' },
        { id: 'callEligible', passed: voice.call_eligible, labelKey: 'admin.voices.defaults.readiness.callEligible' },
        {
            id: 'flashAccepted',
            passed: isAccepted(voice, STANDARD_MODEL_ID, language),
            labelKey: 'admin.voices.defaults.readiness.flashAccepted',
            labelValues: { language: languageName },
        },
        {
            id: 'expressiveAccepted',
            passed: isAccepted(voice, EXPRESSIVE_MODEL_ID, language),
            labelKey: 'admin.voices.defaults.readiness.expressiveAccepted',
            labelValues: { language: languageName },
        },
        {
            id: 'sample',
            passed: hasSample(voice, language),
            labelKey: 'admin.voices.defaults.readiness.sample',
            labelValues: { language: languageName },
        },
    ]
}

export interface DefaultsRequirement {
    language: string
    required: boolean
    needsFallbackPool: boolean
}

/** R0 exit rows: en/es narrator + 4 fallbacks; each D34 light language a narrator. */
export const DEFAULTS_REQUIREMENTS: DefaultsRequirement[] = [
    ...CURATED_LANGUAGES.map((language) => ({ language, required: true, needsFallbackPool: true })),
    ...LIGHT_LANGUAGES.map((language) => ({ language, required: true, needsFallbackPool: false })),
]

export function defaultKeys(rows: readonly VoiceDefaultRow[], role: VoiceDefaultRole, language: string): string[] {
    return rows
        .filter((row) => row.role === role && row.language === language)
        .sort((a, b) => a.rank - b.rank)
        .map((row) => row.voice_key)
}

/** True when the pool mixes at least two genders (unknown genders do not count). */
export function hasMixedGender(voices: readonly (AdminCatalogVoice | undefined)[]): boolean {
    const genders = new Set(voices.map((voice) => voice?.gender).filter(Boolean))
    return genders.size >= 2
}

export const fallbackShortfall = (count: number) => Math.max(0, FALLBACK_POOL_MIN - count)

// ---- Replacement candidates (05 §8.2 A1 fallback; the BFF's `replacement_problem`) ----

/** The BFF's `replacement_problem` refusal codes, in its order (copy under `admin.voices.publishFailures.*`). */
export type ReplacementProblem =
    | 'replacement_self'
    | 'replacement_not_active'
    | 'replacement_premade'
    | 'replacement_not_owned'
    | 'replacement_plan_gated'
    | 'replacement_not_call_eligible'
    | 'replacement_cycle'
    | 'replacement_mismatch'

/**
 * The BFF rule (04 §5.3 I-3, R0 build with §5.4): not the voice itself; `active`;
 * an owned design or remix (before L-2, `HEARD_SOURCE_KINDS`); visibility `public`
 * or `admin` (not `plan_gated`); `call_eligible`; not a two-cycle; the same
 * primary language and gender, and the same age bucket when the voice has one.
 * Null when the candidate qualifies.
 */
export function replacementProblem(voice: AdminCatalogVoice, candidate: AdminCatalogVoice): ReplacementProblem | null {
    if (candidate.voice_key === voice.voice_key) return 'replacement_self'
    const own = replacementTargetProblem(candidate)
    if (own) return own
    if (candidate.replacement_voice_key === voice.voice_key) return 'replacement_cycle'
    if (candidate.primary_language !== voice.primary_language || candidate.gender !== voice.gender) return 'replacement_mismatch'
    if (voice.age !== null && candidate.age !== voice.age) return 'replacement_mismatch'
    return null
}

/** The checks of `replacementProblem` that look at the candidate alone, whatever voice it would replace. */
function replacementTargetProblem(candidate: AdminCatalogVoice): ReplacementProblem | null {
    if (candidate.status !== 'active') return 'replacement_not_active'
    if (candidate.source_kind === 'premade_deprecated') return 'replacement_premade'
    if (!HEARD_SOURCE_KINDS.has(candidate.source_kind)) return 'replacement_not_owned'
    if (candidate.visibility === 'plan_gated') return 'replacement_plan_gated'
    if (!candidate.call_eligible) return 'replacement_not_call_eligible'
    return null
}

/** Whether the BFF accepts `candidate` as the replacement of `voice`. Public voices sort first, then by sort rank. */
export function isReplacementCandidate(voice: AdminCatalogVoice, candidate: AdminCatalogVoice): boolean {
    return replacementProblem(voice, candidate) === null
}

export function replacementCandidates(voice: AdminCatalogVoice, catalog: readonly AdminCatalogVoice[]): AdminCatalogVoice[] {
    return catalog
        .filter((candidate) => isReplacementCandidate(voice, candidate))
        .sort((a, b) => Number(b.visibility === 'public') - Number(a.visibility === 'public') || a.sort_rank - b.sort_rank)
}

/**
 * Targets for re-pointing the voices that depend on `voice` (I-34): every
 * candidate the BFF accepts as the replacement of each known dependent, never
 * `voice` itself (the change is what invalidates it). Dependents that are not
 * loaded cannot be checked here; the server validates them (422
 * `repoint_target_invalid`). Public voices sort first, then by sort rank.
 */
export function repointCandidates(
    voice: Pick<AdminCatalogVoice, 'voice_key'>,
    dependents: readonly AdminCatalogVoice[],
    catalog: readonly AdminCatalogVoice[],
): AdminCatalogVoice[] {
    return catalog
        .filter(
            (candidate) =>
                candidate.voice_key !== voice.voice_key &&
                replacementTargetProblem(candidate) === null &&
                dependents.every((dependent) => isReplacementCandidate(dependent, candidate)),
        )
        .sort((a, b) => Number(b.visibility === 'public') - Number(a.visibility === 'public') || a.sort_rank - b.sort_rank)
}

// ---- Library add (D09) ----

export function libraryChecklist(voice: LibraryVoice): RuleCheck[] {
    const safety = voice.safety_control
    return [
        { id: 'notice', passed: (voice.notice_period_days ?? 0) >= LIBRARY_MIN_NOTICE_DAYS, labelKey: 'admin.voices.library.checklist.notice' },
        { id: 'rate', passed: voice.rate === 1 && voice.fiat_rate === null, labelKey: 'admin.voices.library.checklist.rate' },
        { id: 'liveModeration', passed: voice.live_moderation_enabled === false, labelKey: 'admin.voices.library.checklist.liveModeration' },
        { id: 'category', passed: voice.category !== 'famous', labelKey: 'admin.voices.library.checklist.category' },
        { id: 'safety', passed: safety === null || safety === 'NONE', labelKey: 'admin.voices.library.checklist.safety' },
    ]
}

// ---- Progress (D09 R0 exit) ----

export interface PublishProgress {
    total: number
    byLanguage: Record<string, number>
}

/** Prefers the server summary; otherwise counts published voices per v4-accepted language. */
export function publishProgress(
    voices: readonly AdminCatalogVoice[],
    summary?: { published_total: number; published_by_language: Record<string, number> } | null,
): PublishProgress {
    if (summary) return { total: summary.published_total, byLanguage: summary.published_by_language }
    const byLanguage: Record<string, number> = {}
    let total = 0
    for (const voice of voices) {
        if (!isPublished(voice)) continue
        total += 1
        for (const language of acceptedLanguages(voice)) byLanguage[language] = (byLanguage[language] ?? 0) + 1
    }
    return { total, byLanguage }
}
