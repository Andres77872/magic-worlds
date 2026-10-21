import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isLlmFeatureEnabled } from '@/shared/featureFlags'
import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '@/app/providers/AuthProvider'
import { apiService } from '@/infrastructure'
import { ApiError } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import type { LlmFeature, LlmSelection } from '@/shared/types/llm.types'
import type { EffectiveLlmProfile, LlmFeatureView } from '@/shared/types/llmProfile.types'
import { credentialSession } from './credentialSession'
import { useLlmFeatureSelections } from './LlmFeatureSelectionContext'
import { LlmFeatureControlView, type LlmFeatureChoice } from './LlmFeatureControlView'

type ControlState = {
    accountKey: string; feature: LlmFeature; selectionKey: string
    contract: LlmFeatureView | null; effective: EffectiveLlmProfile | null
    loading: boolean; error: string; choices: LlmFeatureChoice[]; offset: number; total: number; open: boolean
    unassigned: boolean
}
const INHERIT: LlmSelection = { mode: 'inherit' }
const INCOMPATIBLE = new Set(['PROFILE_UNAVAILABLE', 'PROFILE_CREDENTIAL_MODE_INVALID', 'PROVIDER_MODEL_UNAVAILABLE',
    'PROFILE_ENDPOINT_UNSUPPORTED', 'PROFILE_PARAMETER_UNSUPPORTED', 'FEATURE_BYOK_DISABLED', 'PROFILE_INCOMPATIBLE', 'MODEL_CONTEXT_INSUFFICIENT'])
// Nothing (or only a default that cannot serve this feature) is assigned: offer an assignment in place.
const UNASSIGNED = new Set(['SYSTEM_PROFILE_NOT_CONFIGURED', 'PROFILE_INCOMPATIBLE'])
const canSelect = (contract: LlmFeatureView | null | undefined) =>
    !!(contract?.user_selection_enabled || contract?.request_selection_enabled)

/**
 * The preview is read-only. Dispatch resolves again and validates the resulting revision.
 * `onUnassignedChange` reports whether nothing can serve the feature yet (a host such as
 * the call setup holds its start until it is assigned).
 */
export function LlmFeatureControl({ feature, disabled = false, variant, onUnassignedChange, selection: controlledSelection, onSelectionChange, onEffectiveChange }: {
    feature: LlmFeature
    disabled?: boolean
    /** `setting` renders a settings row (the call setup); the default chip fits a composer toolbar. */
    variant?: 'chip' | 'setting'
    onUnassignedChange?: (unassigned: boolean) => void
    /** A retained draft can own public intent while using the same resolver and chooser. */
    selection?: LlmSelection
    onSelectionChange?: (selection: LlmSelection) => void
    /** The previewed resolution (null while loading, failed or unassigned), e.g. to fit a host's budget. */
    onEffectiveChange?: (effective: EffectiveLlmProfile | null) => void
}) {
    const featureFlagGeneration = useFeatureFlags().generation
    const { t } = useTranslation()
    const context = useLlmFeatureSelections()
    // Optional: embedded generators also render outside the app shell (tests, stories).
    const isRoot = useContext(AuthContext)?.user?.user_type === 'root'
    const accountKey = context?.accountKey ?? ''
    const selection = controlledSelection ?? context?.selections[feature] ?? INHERIT
    const selectionKey = JSON.stringify(selection)
    const [state, setState] = useState<ControlState | null>(null)
    const generation = useRef(0)
    const operation = useRef(false)
    useSyncExternalStore(credentialSession.subscribe, credentialSession.getVersion, credentialSession.getVersion)
    const message = t('llmProfiles.feature.unavailable')

    const current = useCallback((ticket: number) => generation.current === ticket &&
        authSession.getSnapshot().accountKey === accountKey && authSession.getSnapshot().sessionPhase === 'authenticated', [accountKey])

    const load = useCallback(async () => {
        if (!isLlmFeatureEnabled(feature) || !accountKey || authSession.getSnapshot().sessionPhase !== 'authenticated') return
        const ticket = ++generation.current
        operation.current = false
        setState(before => {
            // A choice resolved for exactly this selection stays shown while it is checked again (no flicker).
            const kept = before?.accountKey === accountKey && before.feature === feature && before.selectionKey === selectionKey
            return { accountKey, feature, selectionKey, contract: kept ? before.contract : null, effective: kept ? before.effective : null, loading: true, error: '',
            choices: before?.accountKey === accountKey && before.feature === feature ? before.choices : [],
            offset: before?.accountKey === accountKey && before.feature === feature ? before.offset : 0,
            total: before?.accountKey === accountKey && before.feature === feature ? before.total : 0,
            open: before?.accountKey === accountKey && before.feature === feature ? before.open : false, unassigned: false }
        })
        try {
            const intent = JSON.parse(selectionKey) as LlmSelection
            const [features, resolved] = await Promise.all([apiService.getLlmFeatures(),
                apiService.resolveLlmProfile(feature, intent).then(value => ({ value }), (failure: unknown) => ({ failure }))])
            if (!current(ticket)) return
            const contract = features.features.find(value => value.feature_key === feature)
            if (!contract) throw new Error('FEATURE_UNAVAILABLE')
            if ('failure' in resolved) {
                const failure = resolved.failure
                if (intent.mode !== 'inherit' || !(failure instanceof ApiError) || !failure.code || !UNASSIGNED.has(failure.code)) throw failure
                setState(before => before && ({ ...before, contract, effective: null, loading: false, unassigned: true }))
                return
            }
            const effective = resolved.value
            credentialSession.setProject(effective.project_hash, accountKey)
            credentialSession.select(feature, effective)
            setState(before => before && ({ ...before, contract, effective, loading: false }))
        } catch { if (current(ticket)) setState(before => before && ({ ...before, effective: null, loading: false, error: message })) }
    }, [accountKey, feature, selectionKey, current, message, featureFlagGeneration])
    useEffect(() => { void load(); return () => { generation.current++; operation.current = false } }, [load])

    // Only root assigns: the pick becomes the app-wide default, so users never have to choose.
    const canAssign = (contract: LlmFeatureView | null | undefined) => !!contract && isRoot

    const loadChoices = async () => {
        if (!state || operation.current || !(canSelect(state.contract) || (state.unassigned && canAssign(state.contract)))) return
        operation.current = true
        const ticket = generation.current
        setState(before => before && ({ ...before, loading: true, error: '', open: true }))
        try {
            const page = await apiService.getLlmProfiles('available', state.offset)
            if (!current(ticket)) return
            // The resolver refuses personal profiles where saved choices or personal keys are off (calls):
            // leave them out instead of listing them as incompatible.
            const personal = !!state.contract?.user_selection_enabled && !!state.contract.byok_enabled
            const items = personal ? page.items : page.items.filter(profile => profile.scope !== 'user')
            const choices: LlmFeatureChoice[] = new Array(items.length)
            let cursor = 0
            // Bound catalog validation requests. Each role is checked by the server resolver.
            const checks = await Promise.allSettled(Array.from({ length: Math.min(3, items.length) }, async () => {
                while (cursor < items.length && current(ticket)) {
                    const index = cursor++, profile = items[index]
                    let compatible = profile.status === 'active' && Boolean(profile.revision_id)
                    if (compatible) {
                        try { await apiService.resolveLlmProfile(feature, { mode: 'profile', profile_id: profile.profile_id }) }
                        catch (failure) {
                            if (!(failure instanceof ApiError) || !failure.code || !INCOMPATIBLE.has(failure.code)) throw failure
                            compatible = false
                        }
                    }
                    choices[index] = { profile, compatible }
                }
            }))
            const failed = checks.find(check => check.status === 'rejected')
            if (failed?.status === 'rejected') throw failed.reason
            if (!current(ticket)) return
            setState(before => before && ({ ...before, loading: false, total: page.total, offset: page.offset + page.items.length,
                choices: [...before.choices, ...choices].filter((choice, index, all) => all.findIndex(value => value.profile.profile_id === choice.profile.profile_id) === index) }))
        } catch { if (current(ticket)) setState(before => before && ({ ...before, loading: false, error: message })) }
        finally { if (current(ticket)) operation.current = false }
    }

    const choose = async (intent: LlmSelection) => {
        if (!canSelect(state?.contract) || !context || operation.current || disabled) return
        operation.current = true
        const ticket = generation.current
        setState(before => before && ({ ...before, loading: true, error: '' }))
        try {
            const effective = await apiService.resolveLlmProfile(feature, intent)
            if (!current(ticket)) return
            context.select(feature, intent, effective)
            onSelectionChange?.({ ...intent })
            setState(before => before && ({ ...before, selectionKey: JSON.stringify(intent), effective, loading: false }))
        } catch { if (current(ticket)) setState(before => before && ({ ...before, loading: false, error: message })) }
        finally { if (current(ticket)) operation.current = false }
    }

    /** Root saves the app policy: with no default yet the pick becomes the universal default;
     *  otherwise (the default cannot serve this feature) it becomes this feature's app profile. */
    const assign = async (profileId: string) => {
        if (!state?.unassigned || !canAssign(state.contract) || operation.current || disabled) return
        operation.current = true
        const ticket = generation.current
        setState(before => before && ({ ...before, loading: true, error: '' }))
        try {
            await apiService.resolveLlmProfile(feature, { mode: 'profile', profile_id: profileId })
            const saved = await apiService.getLlmPreferences(true)
            if (!current(ticket)) return
            await apiService.saveLlmPreferences(saved.default_profile_id
                ? { default_profile_id: saved.default_profile_id, feature_profiles: { ...saved.feature_profiles, [feature]: profileId } }
                : { default_profile_id: profileId, feature_profiles: saved.feature_profiles }, saved.row_version, true)
        } catch {
            if (current(ticket)) setState(before => before && ({ ...before, loading: false, error: t('llmProfiles.feature.assignFailed') }))
            return
        } finally { if (current(ticket)) operation.current = false }
        if (current(ticket)) void load()
    }

    const visible = state?.accountKey === accountKey && state.feature === feature && state.selectionKey === selectionKey ? state : null
    const autoChoices = !!visible?.unassigned && !visible.open && !visible.loading && !visible.error && canAssign(visible.contract)
    // Show assignable profiles right away instead of an error when nothing is assigned yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (autoChoices) void loadChoices() }, [autoChoices])
    const unassigned = !!visible?.unassigned
    useEffect(() => { onUnassignedChange?.(unassigned) }, [unassigned, onUnassignedChange])
    const effective = visible?.effective ?? null
    useEffect(() => { onEffectiveChange?.(effective) }, [effective, onEffectiveChange])

    if (!context || authSession.getSnapshot().sessionPhase !== 'authenticated') return null
    if (!isLlmFeatureEnabled(feature)) return null
    return <LlmFeatureControlView feature={feature} variant={variant} selection={selection} effective={visible?.effective ?? null}
        editable={canSelect(visible?.contract)} loading={visible?.loading ?? true} disabled={disabled}
        error={visible?.error} choicesOpen={visible?.open} choices={visible?.choices} more={!!visible && visible.offset < visible.total}
        unassigned={!!visible?.unassigned} canAssign={!!visible && canAssign(visible.contract)}
        onAssign={profileId => { void assign(profileId) }}
        keyAvailable={!!visible?.effective && credentialSession.has(visible.effective)}
        onOpen={() => { if (visible?.open) setState(before => before && ({ ...before, open: false })); else if (visible?.choices.length) setState(before => before && ({ ...before, open: true })); else void loadChoices() }}
        onSelect={intent => { void choose(intent) }} onMore={() => { void loadChoices() }} onRefresh={() => { void load() }}
        onForget={() => { if (visible?.effective) credentialSession.forget(visible.effective) }} />
}
