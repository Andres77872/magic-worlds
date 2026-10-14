import { describe, expect, it } from 'vitest'
import {
    allPassed,
    callEligibleFrom,
    computeGainDb,
    exceedsAttenuation,
    libraryChecklist,
    loudnessFlags,
    providerDeleteBlockers,
    publishChecklist,
    publishProgress,
    readinessChecks,
    remixEligibility,
    replacementCandidates,
    replacementProblem,
    repointCandidates,
    verdictBlocker,
} from './consoleRules'
import { runtimeGateState } from './components/shell/limitsMath'
import type { AdminCatalogVoice } from '@/shared'
import { auditLibraryPage, draftVoice, libraryVoice, makeAcceptance, makeCatalogVoice, readyVoice, replacementVoice } from './fixtures'

const failing = (checks: { id: string; passed: boolean }[]) => checks.filter((check) => !check.passed).map((check) => check.id)

describe('publishChecklist (05 §8.3)', () => {
    it('passes for an accepted, call-eligible owned voice with samples and a replacement', () => {
        expect(allPassed(publishChecklist(readyVoice, { visibility: 'public' }))).toBe(true)
    })

    it('fails the replacement row when the stored replacement no longer qualifies (the BFF re-runs replacement_problem)', () => {
        const valid = { ...replacementVoice, replacement_voice_key: null }
        const replacementRow = (replacement: AdminCatalogVoice | undefined) =>
            publishChecklist(readyVoice, { visibility: 'public', replacement }).find((check) => check.id === 'replacement')
        expect(replacementRow(valid)).toMatchObject({ passed: true })
        // Not in the loaded pages: unknown, so only its presence is checked.
        expect(replacementRow(undefined)).toMatchObject({ passed: true })
        expect(replacementRow({ ...valid, status: 'hidden' })).toMatchObject({ passed: false, noteKey: 'admin.voices.publishFailures.replacement_not_active' })
        expect(replacementRow({ ...valid, visibility: 'plan_gated', min_plan: 'plus' })).toMatchObject({ passed: false, noteKey: 'admin.voices.publishFailures.replacement_plan_gated' })
        expect(replacementRow({ ...valid, gender: 'male' })).toMatchObject({ passed: false, noteKey: 'admin.voices.publishFailures.replacement_mismatch' })
        // The fixture pair points at each other: a two-cycle the BFF refuses.
        expect(replacementRow(replacementVoice)).toMatchObject({ passed: false, noteKey: 'admin.voices.publishFailures.replacement_cycle' })
        // A row for another key (stale index entry) is not used.
        expect(replacementRow({ ...valid, voice_key: 'vk_other', status: 'hidden' })).toMatchObject({ passed: true })
        expect(publishChecklist({ ...readyVoice, replacement_voice_key: null }, { visibility: 'public', replacement: valid })
            .find((check) => check.id === 'replacement')).toEqual({ id: 'replacement', passed: false, labelKey: 'admin.voices.catalog.publishChecklist.replacement' })
    })

    it('names every unmet item for a fresh draft', () => {
        expect(failing(publishChecklist(draftVoice, { visibility: 'public' }))).toEqual([
            'flashAccepted',
            'expressiveAccepted',
            'callConsistency',
            'callEligible',
            'samples',
            'replacement',
        ])
    })

    it('requires an own sample for every Flash-accepted language', () => {
        const voice = {
            ...readyVoice,
            acceptance: [...readyVoice.acceptance, makeAcceptance({ language: 'es' }), makeAcceptance({ language: 'es', model_id: 'eleven_v4' })],
        }
        expect(failing(publishChecklist(voice, { visibility: 'public' }))).toEqual(['samples'])
    })

    it('requires a v4 pass and Flash consistency of at least 4 in every Flash-accepted language (P-13)', () => {
        const withEs = (...rows: ReturnType<typeof makeAcceptance>[]) => ({
            ...readyVoice,
            languages: [...readyVoice.languages, { ...readyVoice.languages[0], language: 'es' }],
            acceptance: [...readyVoice.acceptance, ...rows],
        })
        const noV4 = withEs(makeAcceptance({ language: 'es' }))
        expect(failing(publishChecklist(noV4, { visibility: 'public' }))).toEqual(['expressiveAccepted'])
        const v4Failed = withEs(makeAcceptance({ language: 'es' }), makeAcceptance({ language: 'es', model_id: 'eleven_v4', verdict: 'fail' }))
        expect(failing(publishChecklist(v4Failed, { visibility: 'public' }))).toEqual(['expressiveAccepted'])
        const lowConsistency = withEs(
            makeAcceptance({ language: 'es', scores: { timbre: 4, naturalness: 4, emotion_tags: 4, accent: 4, artefacts: 4, consistency_vs_v4: 3 } }),
            makeAcceptance({ language: 'es', model_id: 'eleven_v4' }),
        )
        expect(failing(publishChecklist(lowConsistency, { visibility: 'public' }))).toEqual(['callConsistency'])
    })

    it('publishes designs and remixes only: instant clones and other kinds name their reason', () => {
        const clone = publishChecklist({ ...readyVoice, source_kind: 'ivc' }, { visibility: 'public' })
        expect(clone.find((check) => check.id === 'sourceKind')).toMatchObject({ passed: false, noteKey: 'admin.voices.catalog.publishChecklist.ivcBlocked' })
        const shared = publishChecklist({ ...readyVoice, source_kind: 'pvc_shared' }, { visibility: 'public' })
        expect(shared.find((check) => check.id === 'sourceKind')).toMatchObject({ passed: false, noteKey: 'admin.voices.catalog.publishChecklist.blockedUntilL2' })
        expect(publishChecklist({ ...readyVoice, source_kind: 'remixed' }, { visibility: 'public' }).find((check) => check.id === 'sourceKind')?.passed).toBe(true)
    })

    it('blocks Library kinds until L-2 and premade voices always', () => {
        const library = publishChecklist(libraryVoice, { visibility: 'public' })
        expect(library.find((check) => check.id === 'sourceKind')).toMatchObject({ passed: false, noteKey: 'admin.voices.catalog.publishChecklist.blockedUntilL2' })
        const premade = publishChecklist({ ...readyVoice, source_kind: 'premade_deprecated' }, { visibility: 'public' })
        expect(premade.find((check) => check.id === 'sourceKind')?.noteKey).toBe('admin.voices.catalog.publishChecklist.premade')
    })

    it('requires a minimum plan only for plan-gated publishing, and has no legacy-route item (I-68)', () => {
        expect(failing(publishChecklist(readyVoice, { visibility: 'plan_gated' }))).toEqual(['minPlan'])
        expect(publishChecklist(readyVoice, { visibility: 'public' }).map((check) => check.id)).not.toContain('legacyFallback')
        expect(failing(publishChecklist({ ...readyVoice, min_plan: 'plus' }, { visibility: 'plan_gated' }))).toEqual([])
    })
})

describe('loudness (D16)', () => {
    it('computes an attenuation-only gain against −18 LUFS', () => {
        expect(computeGainDb(-14)).toBe(-4)
        expect(computeGainDb(-18)).toBe(0)
        expect(computeGainDb(-22)).toBe(0)
        expect(computeGainDb(null)).toBeNull()
    })

    it('flags voices needing more than −6 dB and voices quieter than the target', () => {
        expect(loudnessFlags(-11)).toEqual({ gainDb: -7, tooLoud: true, tooQuiet: false })
        expect(loudnessFlags(-12)).toEqual({ gainDb: -6, tooLoud: false, tooQuiet: false })
        expect(loudnessFlags(-20)).toEqual({ gainDb: 0, tooLoud: false, tooQuiet: true })
    })

    it('applies the −6 dB rule to the unrounded gain, as the server does (I-15)', () => {
        expect(exceedsAttenuation(-12)).toBe(false)
        expect(exceedsAttenuation(-11.99)).toBe(true)
        expect(computeGainDb(-11.99)).toBe(-6)
        expect(exceedsAttenuation(null)).toBe(false)
        expect(exceedsAttenuation(Number.NaN)).toBe(false)
    })

    it('blocks a pass without loudness or beyond −6 dB, never a fail (I-15)', () => {
        expect(verdictBlocker('pass', null)).toBe('lufs_required')
        expect(verdictBlocker('pass', Number.NaN)).toBe('lufs_required')
        expect(verdictBlocker('pass', -10)).toBe('gain_out_of_range')
        expect(verdictBlocker('pass', -12)).toBeNull()
        expect(verdictBlocker('pass', -30)).toBeNull()
        expect(verdictBlocker('fail', -10)).toBeNull()
        expect(verdictBlocker('fail', null)).toBeNull()
        expect(verdictBlocker(null, -10)).toBeNull()
    })
})

describe('callEligibleFrom (D09)', () => {
    it('requires a Flash pass and consistency of at least 4', () => {
        expect(callEligibleFrom('eleven_flash_v2_5', 'pass', { consistency_vs_v4: 4 })).toBe(true)
        expect(callEligibleFrom('eleven_flash_v2_5', 'pass', { consistency_vs_v4: 3 })).toBe(false)
        expect(callEligibleFrom('eleven_flash_v2_5', 'fail', { consistency_vs_v4: 5 })).toBe(false)
        expect(callEligibleFrom('eleven_v4', 'pass', { consistency_vs_v4: 5 })).toBe(false)
    })
})

describe('remixEligibility (05 §8.9)', () => {
    it('allows designed and remixed voices and explains every refusal', () => {
        expect(remixEligibility(draftVoice)).toEqual({ eligible: true, reasonKey: null })
        expect(remixEligibility({ ...draftVoice, source_kind: 'remixed' }).eligible).toBe(true)
        expect(remixEligibility({ ...draftVoice, source_kind: 'ivc' }).reasonKey).toBe('admin.voices.remix.ivcBlocked')
        expect(remixEligibility(libraryVoice).reasonKey).toBe('admin.voices.remix.libraryRuleBlocked')
        expect(remixEligibility({ ...draftVoice, status: 'removed' }).reasonKey).toBe('admin.voices.remix.unavailable')
        expect(remixEligibility({ ...draftVoice, source_kind: 'pvc_shared' }).reasonKey).toBe('admin.voices.remix.notOwned')
    })
})

describe('readinessChecks (03 §5.11)', () => {
    it('passes an active owned voice accepted on Flash and v4 with a sample', () => {
        expect(allPassed(readinessChecks(readyVoice, 'en', 'English'))).toBe(true)
    })

    it('fails on the missing v4 acceptance and sample for another language', () => {
        expect(failing(readinessChecks(readyVoice, 'es', 'Spanish'))).toEqual(['flashAccepted', 'expressiveAccepted', 'sample'])
        expect(failing(readinessChecks(libraryVoice, 'en', 'English'))).toEqual(['sourceKind', 'active', 'expressiveAccepted'])
    })
})

describe('providerDeleteBlockers (D19)', () => {
    it('needs an owned voice with no references that is not leaving', () => {
        expect(allPassed(providerDeleteBlockers(draftVoice))).toBe(true)
        expect(failing(providerDeleteBlockers(readyVoice))).toEqual(['references'])
        expect(failing(providerDeleteBlockers({ ...libraryVoice, reference_count: 0 }))).toEqual(['owned'])
        expect(failing(providerDeleteBlockers({ ...draftVoice, status: 'deprecating' }))).toEqual(['status'])
    })
})

describe('libraryChecklist (D09)', () => {
    it('passes curated terms and fails each custom term', () => {
        const voice = auditLibraryPage.items[0]
        expect(allPassed(libraryChecklist(voice))).toBe(true)
        expect(failing(libraryChecklist({ ...voice, notice_period_days: 30, fiat_rate: 0.2, live_moderation_enabled: true, category: 'famous', safety_control: 'BAN' }))).toEqual([
            'notice',
            'rate',
            'liveModeration',
            'category',
            'safety',
        ])
    })
})

describe('replacementCandidates and progress', () => {
    it('matches the BFF rule: active, call eligible, owned design or remix, public or admin, no two-cycle, same language, gender and age', () => {
        const candidate = (key: string, overrides: Partial<AdminCatalogVoice> = {}) =>
            makeCatalogVoice({ voice_key: key, gender: 'female', status: 'active', visibility: 'public', call_eligible: true, sort_rank: 5, ...overrides })
        const catalog = [
            readyVoice,
            candidate('vk_public'),
            candidate('vk_admin', { visibility: 'admin', sort_rank: 1 }),
            candidate('vk_remix', { source_kind: 'remixed', sort_rank: 9 }),
            candidate('vk_library', { source_kind: 'library_noticed' }),
            candidate('vk_ivc', { source_kind: 'ivc' }),
            candidate('vk_gated', { visibility: 'plan_gated', min_plan: 'plus' }),
            candidate('vk_ineligible', { call_eligible: false }),
            candidate('vk_hidden', { status: 'hidden' }),
            candidate('vk_cycle', { replacement_voice_key: readyVoice.voice_key }),
            candidate('vk_es', { primary_language: 'es' }),
            candidate('vk_male', { gender: 'male' }),
            candidate('vk_young', { age: 'young' }),
            replacementVoice,
            draftVoice,
        ]
        // Public first, then by sort rank; replacementVoice already points at readyVoice (two-cycle).
        expect(replacementCandidates(readyVoice, catalog).map((voice) => voice.voice_key)).toEqual(['vk_public', 'vk_remix', 'vk_admin'])
        // No age bucket on the voice: the age is not compared.
        expect(replacementCandidates({ ...readyVoice, age: null }, catalog).map((voice) => voice.voice_key)).toContain('vk_young')
        // Each refusal carries the BFF code, in the BFF's order.
        const byKey = new Map(catalog.map((voice) => [voice.voice_key, voice]))
        const problem = (key: string) => replacementProblem(readyVoice, byKey.get(key)!)
        expect(problem(readyVoice.voice_key)).toBe('replacement_self')
        expect(problem('vk_hidden')).toBe('replacement_not_active')
        expect(replacementProblem(readyVoice, candidate('vk_premade', { source_kind: 'premade_deprecated' }))).toBe('replacement_premade')
        expect(problem('vk_ivc')).toBe('replacement_not_owned')
        expect(problem('vk_library')).toBe('replacement_not_owned')
        expect(problem('vk_gated')).toBe('replacement_plan_gated')
        expect(problem('vk_ineligible')).toBe('replacement_not_call_eligible')
        expect(problem('vk_cycle')).toBe('replacement_cycle')
        expect(problem('vk_es')).toBe('replacement_mismatch')
        expect(problem('vk_young')).toBe('replacement_mismatch')
        expect(problem('vk_public')).toBeNull()
    })

    it('offers re-point targets that fit every known dependent, never the voice being changed (I-34)', () => {
        const voice = (key: string, overrides: Partial<AdminCatalogVoice> = {}) =>
            makeCatalogVoice({ voice_key: key, gender: 'female', status: 'active', visibility: 'public', call_eligible: true, sort_rank: 5, ...overrides })
        const changed = voice('vk_changed')
        const dependentA = voice('vk_dep_a', { replacement_voice_key: 'vk_changed' })
        const dependentB = voice('vk_dep_b', { replacement_voice_key: 'vk_changed', age: null })
        const catalog = [
            changed,
            dependentA,
            dependentB,
            voice('vk_fits', { sort_rank: 7 }),
            voice('vk_fits_admin', { visibility: 'admin', sort_rank: 1 }),
            // Fits B (no age bucket) but not A.
            voice('vk_young', { age: 'young' }),
            // Points back at dependent A: a two-cycle for A.
            voice('vk_cycle', { replacement_voice_key: 'vk_dep_a' }),
            voice('vk_hidden', { status: 'hidden' }),
        ]
        expect(repointCandidates(changed, [dependentA, dependentB], catalog).map((entry) => entry.voice_key)).toEqual(['vk_fits', 'vk_fits_admin'])
        // Only B known: the young voice and A itself qualify too; the changed voice never does.
        expect(repointCandidates(changed, [dependentB], catalog).map((entry) => entry.voice_key)).toEqual(['vk_dep_a', 'vk_young', 'vk_cycle', 'vk_fits', 'vk_fits_admin'])
        // No dependent loaded: every voice that can be a replacement at all, but the changed one; the server checks the rest.
        expect(repointCandidates(changed, [], catalog).map((entry) => entry.voice_key)).toEqual(['vk_dep_a', 'vk_dep_b', 'vk_young', 'vk_cycle', 'vk_fits', 'vk_fits_admin'])
    })

    it('counts published voices per Flash-accepted language, preferring the server summary', () => {
        expect(publishProgress([readyVoice, replacementVoice, draftVoice, libraryVoice])).toEqual({ total: 2, byLanguage: { en: 2 } })
        expect(publishProgress([], { published_total: 7, published_by_language: { es: 3 } })).toEqual({ total: 7, byLanguage: { es: 3 } })
    })
})

describe('runtimeGateState (I-12)', () => {
    it('reads env-gated booleans as env AND db, and ignores every other row', () => {
        expect(runtimeGateState('tts_engine_enabled', false)).toEqual({ env: 'TTS_ENGINE_ENABLED', dbOn: false })
        expect(runtimeGateState('voice_mode_enabled', true)).toEqual({ env: 'VOICE_MODE_ENABLED', dbOn: true })
        expect(runtimeGateState('voice_mode_enabled', 'true')).toBeNull()
        expect(runtimeGateState('auto_narration_paused', false)).toBeNull()
        expect(runtimeGateState('daily_budget_chars', 1000)).toBeNull()
    })
})
