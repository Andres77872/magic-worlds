import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * State and API actions behind both LLM profile pages (the user's "Models and
 * profiles" and root's "LLM profiles"). The view renders whatever this returns,
 * so Storybook can feed it fixtures instead.
 */
import { isLlmFeatureEnabled } from '@/shared/featureFlags'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure'
import { ApiError } from '@/infrastructure/api'
import { prepareLlmRequest, prepareRetainedLlmRequest } from '@/infrastructure/api/llmPreparation'
import type { LlmFeature, LlmRequest } from '@/shared/types/llm.types'
import type {
    LlmAuditEvent,
    LlmCapacityUsage,
    LlmCatalogModel,
    LlmConnection,
    LlmFeatureView,
    LlmPreferences,
    LlmPreferencesView,
    LlmProfileDetail,
    LlmProfileMutation,
    LlmProfileSummary,
    LlmProfileTestResult,
    LlmProfileTestTarget,
    LlmProfileRole,
    LlmRole,
} from '@/shared/types/llmProfile.types'
import { credentialSession } from './credentialSession'
import type { LlmCompatibilityState } from './LlmProfileCompatibilityPanel'
import type { ProfileEditorMode } from './ProfileEditor'
import { assignmentIssuesFrom, configKey, roleFor, stableJson, usableModels, customProfileConfig, customProfileReady, type AssignmentIssues } from './llmProfileModel'

export const PROFILE_PAGE_SIZE = 25

const KNOWN_ERRORS = new Set(['PROFILE_IN_USE', 'PROFILE_REQUEST_INVALID', 'PROFILE_VERSION_CONFLICT', 'PROFILE_UNAVAILABLE',
    'CATALOG_UNAVAILABLE', 'PROFILE_JSON_INVALID'])

export interface LlmProfilesEditorState {
    mode: ProfileEditorMode
    draft: LlmProfileMutation
    editing: LlmProfileDetail | null
    dirty: boolean
    draftUnsaved: boolean
    compatibility: LlmCompatibilityState | null
    propsKey: number
    propsInvalid: boolean
    propsServerError?: string
    testFeatures: LlmFeatureView[]
    testFeature: LlmFeature | undefined
    testResult: LlmProfileTestResult | null
}

export interface LlmProfilesConsoleActions {
    refresh: () => void
    setOffset: (offset: number) => void
    create: () => void
    open: (profile: LlmProfileSummary) => void
    closeEditor: () => void
    updateDraft: (draft: LlmProfileMutation) => void
    chooseModel: (role: LlmRole, catalogModelKey: string) => void
    setPropsValidity: (valid: boolean) => void
    setTestFeature: (feature: LlmFeature) => void
    save: () => void
    validate: () => void
    test: (kind: LlmProfileTestTarget['kind']) => void
    rollback: (revisionId: string) => void
    loadMoreModels: () => void
    copyPersonal: () => void
    requestPublish: () => void
    requestArchive: () => void
    cancelConfirm: () => void
    confirm: () => void
    setAssignments: (next: LlmPreferences) => void
    saveAssignments: () => void
    /** Root: make a published profile the app default for everyone (saves the policy right away). */
    setAppDefault: (profileId: string) => void
    syncCatalog: () => void
    forgetKeys: () => void
    clearNotice: () => void
}

export interface LlmProfilesConsole {
    systemAdmin: boolean
    loading: boolean
    busy: boolean
    error: string
    notice: string
    profiles: LlmProfileSummary[]
    /** Per profile: its detail (model, status, impact), null when it could not be loaded; missing while loading. */
    details: Record<string, LlmProfileDetail | null>
    models: LlmCatalogModel[]
    modelsTotal: number
    /** At least one catalog model a profile can use. */
    hasUsableModels: boolean
    connections: LlmConnection[]
    features: LlmFeatureView[]
    preferences: LlmPreferencesView | null
    assignments: LlmPreferences | null
    assignmentsDirty: boolean
    assignmentIssues: AssignmentIssues | null
    /** Root: features the (edited) default profile cannot serve. They need their own profile. */
    defaultGaps: LlmFeature[]
    audit: LlmAuditEvent[]
    capacityUsage: LlmCapacityUsage | null
    capacityError: string
    page: { offset: number; total: number; size: number }
    editor: LlmProfilesEditorState | null
    confirm: { kind: 'publish' | 'archive'; message: string } | null
    actions: LlmProfilesConsoleActions
}

const toAssignments = (preferences: LlmPreferences): LlmPreferences =>
    ({ default_profile_id: preferences.default_profile_id, feature_profiles: { ...preferences.feature_profiles } })

export function useLlmProfilesConsole(systemAdmin: boolean): LlmProfilesConsole & { authorized: boolean } {
    const featureFlagGeneration = useFeatureFlags().generation
    const { t } = useTranslation()
    const { isAuthenticated, accountKey, user } = useAuth()
    const authorized = isAuthenticated && (!systemAdmin || user?.user_type === 'root')
    const [profiles, setProfiles] = useState<LlmProfileSummary[]>([])
    const [details, setDetails] = useState<Record<string, LlmProfileDetail | null>>({})
    const [total, setTotal] = useState(0)
    const [offset, setOffset] = useState(0)
    const [models, setModels] = useState<LlmCatalogModel[]>([])
    const [modelsTotal, setModelsTotal] = useState(0)
    const [features, setFeatures] = useState<LlmFeatureView[]>([])
    const [connections, setConnections] = useState<LlmConnection[]>([])
    const [preferences, setPreferences] = useState<LlmPreferencesView | null>(null)
    const [assignments, setAssignments] = useState<LlmPreferences | null>(null)
    const [assignmentIssues, setAssignmentIssues] = useState<AssignmentIssues | null>(null)
    const [audit, setAudit] = useState<LlmAuditEvent[]>([])
    const [capacityUsage, setCapacityUsage] = useState<LlmCapacityUsage | null>(null)
    const [capacityError, setCapacityError] = useState('')
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const busyRef = useRef(false)
    const testIntent = useRef<{ key: string; request: string; parent?: string; nextRetry?: LlmRequest } | null>(null)
    const [testFeature, setTestFeature] = useState<LlmFeature>('novel')
    const [testResult, setTestResult] = useState<LlmProfileTestResult | null>(null)
    const [compatibility, setCompatibility] = useState<{ key: string; state: LlmCompatibilityState } | null>(null)
    const [error, setError] = useState('')
    const [errorCode, setErrorCode] = useState('')
    const [notice, setNotice] = useState('')
    const [editing, setEditing] = useState<LlmProfileDetail | null>(null)
    const [draft, setDraft] = useState<LlmProfileMutation | null>(null)
    const [readOnly, setReadOnly] = useState(false)
    const [propsKey, setPropsKey] = useState(0)
    const [propsInvalid, setPropsInvalid] = useState(false)
    const [confirming, setConfirming] = useState<'publish' | 'archive' | null>(null)
    const [defaultFit, setDefaultFit] = useState<{ key: string; gaps: LlmFeature[] } | null>(null)
    const generation = useRef(0)
    const owner = useRef(accountKey)
    owner.current = accountKey

    const message = useCallback((failure: unknown) => {
        if (!(failure instanceof ApiError) || !failure.code) return t('llmProfiles.failed')
        return KNOWN_ERRORS.has(failure.code) ? t(`llmProfiles.errors.${failure.code}`) : `${t('llmProfiles.failed')} (${failure.code})`
    }, [t])

    const load = useCallback(async () => {
        if (!authorized) return
        const epoch = ++generation.current
        setLoading(true)
        setError(''); setErrorCode('')
        // Model listing is independent: a slow or unavailable list never blocks custom profiles.
        void apiService.getLlmModels({ credential_mode: systemAdmin ? 'platform' : 'user_byok', limit: 100 }).then(catalog => {
            if (epoch === generation.current) { setModels(catalog.items); setModelsTotal(catalog.total) }
        }, failure => {
            if (epoch === generation.current) {
                setModels([]); setModelsTotal(0)
                if (systemAdmin) setError(message(failure))
            }
        })
        try {
            const [page, featureList, prefs, connectionList, events, capacity] = await Promise.all([
                apiService.getLlmProfiles('available', offset, systemAdmin),
                apiService.getLlmFeatures(), apiService.getLlmPreferences(systemAdmin),
                systemAdmin ? apiService.getLlmConnections() : Promise.resolve({ connections: [] }),
                systemAdmin ? apiService.getLlmAudit() : Promise.resolve({ items: [] }),
                systemAdmin ? Promise.resolve({ usage: null, error: '' }) : apiService.getLlmCapacityUsage()
                    .then(usage => ({ usage, error: '' }), () => ({ usage: null, error: t('llmProfiles.usage.unavailable') })),
            ])
            if (epoch !== generation.current) return
            setProfiles(page.items); setTotal(page.total)
            setFeatures(featureList.features.filter(feature => isLlmFeatureEnabled(feature.feature_key))); setPreferences(prefs); setAssignments(toAssignments(prefs)); setAssignmentIssues(null)
            setConnections(connectionList.connections); setAudit(events.items)
            setCapacityUsage(capacity.usage); setCapacityError(capacity.error)
            // Card facts (model, version, props, impact) come from each profile's detail; a failure only hides them.
            void Promise.all(page.items.map(item => apiService.getLlmProfile(item.profile_id, systemAdmin)
                .then(detail => [item.profile_id, detail] as const, () => [item.profile_id, null] as const)))
                .then(entries => { if (epoch === generation.current) setDetails(Object.fromEntries(entries)) })
        } catch (failure) { if (epoch === generation.current) setError(message(failure)) }
        finally { if (epoch === generation.current) setLoading(false) }
    }, [authorized, offset, systemAdmin, message, t, featureFlagGeneration])

    useEffect(() => {
        testIntent.current = null
        setDraft(null); setEditing(null); setPreferences(null); setAssignments(null); setProfiles([]); setDetails({})
        setCapacityUsage(null); setCapacityError('')
        void load()
        return () => { generation.current++ }
    }, [accountKey, load])

    // Server-side compatibility of the configuration being edited, debounced and
    // keyed so a slower answer for an earlier configuration is never shown.
    const compatibilityKey = draft && !readOnly && customProfileReady(draft.config) ? JSON.stringify(draft.config) : null
    useEffect(() => {
        if (!compatibilityKey) return
        let cancelled = false
        const timer = window.setTimeout(() => {
            apiService.checkLlmProfileCompatibility(JSON.parse(compatibilityKey) as LlmProfileMutation['config'], systemAdmin).then(
                report => { if (!cancelled) setCompatibility({ key: compatibilityKey, state: { status: 'ready', report } }) },
                () => { if (!cancelled) setCompatibility({ key: compatibilityKey, state: { status: 'unavailable', report: null } }) })
        }, 400)
        return () => { cancelled = true; window.clearTimeout(timer) }
    }, [compatibilityKey, systemAdmin])
    const compatibilityState: LlmCompatibilityState = compatibility && compatibility.key === compatibilityKey
        ? compatibility.state : { status: 'checking', report: null }

    // Root: which features the default profile (as edited in the table) cannot serve, from its published configuration.
    const defaultId = systemAdmin ? assignments?.default_profile_id ?? null : null
    const defaultConfig = defaultId ? details[defaultId]?.current?.config : undefined
    const defaultConfigKey = defaultConfig ? JSON.stringify(defaultConfig) : null
    useEffect(() => {
        if (!defaultConfigKey) return
        let cancelled = false
        apiService.checkLlmProfileCompatibility(JSON.parse(defaultConfigKey) as LlmProfileMutation['config'], true).then(report => {
            if (cancelled) return
            const gaps = report.configuration_issue ? features.map(item => item.feature_key)
                : report.features.filter(row => !row.compatible).map(row => row.feature)
            setDefaultFit({ key: defaultConfigKey, gaps })
        }, () => { if (!cancelled) setDefaultFit(null) })
        return () => { cancelled = true }
    }, [defaultConfigKey, features])
    const defaultGaps = defaultFit && defaultFit.key === defaultConfigKey ? defaultFit.gaps : []

    const act = async (action: () => Promise<void>) => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(true); setError(''); setErrorCode(''); setNotice('')
        const expectedOwner = owner.current
        try { await action() } catch (failure) {
            if (expectedOwner === owner.current) {
                setError(message(failure))
                setErrorCode(failure instanceof ApiError ? failure.code ?? '' : '')
            }
        }
        finally { busyRef.current = false; if (expectedOwner === owner.current) setBusy(false) }
    }

    const startEditor = (next: LlmProfileMutation, detail: LlmProfileDetail | null, viewOnly: boolean) => {
        setEditing(detail); setReadOnly(viewOnly); setDraft(next)
        setPropsInvalid(false); setPropsKey(key => key + 1); setTestResult(null); setConfirming(null)
    }

    const usable = usableModels(models)
    const create = () => {
        const model = usable[0]
        if (!model && systemAdmin) { setError(t('llmProfiles.catalogUnavailable')); return }
        setError(''); setErrorCode('')
        if (!model) { startEditor({ name: '', description: '', config: customProfileConfig() }, null, false); return }
        startEditor({ name: '', description: '', config: { provider_target_key: model.provider_target_key, catalog_revision: model.catalog_revision,
            platform_connection_key: systemAdmin ? connections.find(value => value.available && value.provider_target_key === model.provider_target_key)?.connection_key ?? null : null,
            roles: { primary: roleFor(model) } } }, null, false)
    }

    const open = (profile: LlmProfileSummary) => void act(async () => {
        const detail = await apiService.getLlmProfile(profile.profile_id, systemAdmin)
        const config = systemAdmin ? detail.draft_config : detail.current?.config
        if (!config) throw new Error('PROFILE_CONFIG_UNAVAILABLE')
        startEditor({ name: detail.name, description: detail.description, config: structuredClone(config) }, detail, !systemAdmin && detail.scope === 'system')
    })

    const setRole = (role: LlmRole, value: LlmProfileRole | undefined) => setDraft(before => {
        if (!before || role === 'primary' && !value) return before
        const roles = { ...before.config.roles }
        if (value) roles[role] = value; else delete roles[role]
        return { ...before, config: { ...before.config, roles } }
    })

    const chooseModel = (role: LlmRole, id: string) => {
        const model = models.find(value => value.catalog_model_key === id)
        if (!model) { if (role !== 'primary') setRole(role, undefined); return }
        if (role !== 'primary') { setRole(role, roleFor(model)); return }
        if (!draft) return
        // Helper roles and custom props only survive when the provider and catalog stay the same.
        const before = draft.config
        const sameTarget = before.provider_target_key === model.provider_target_key && before.catalog_revision === model.catalog_revision
        const roles: LlmProfileMutation['config']['roles'] = { primary: roleFor(model) }
        if (sameTarget) for (const helper of ['metadata', 'preflight'] as const) if (before.roles[helper]) roles[helper] = before.roles[helper]
        const config: LlmProfileMutation['config'] = { provider_target_key: model.provider_target_key, catalog_revision: model.catalog_revision,
            platform_connection_key: systemAdmin ? connections.find(value => value.available && value.provider_target_key === model.provider_target_key)?.connection_key ?? null : null,
            roles }
        if (sameTarget && before.provider_options) config.provider_options = before.provider_options
        else if (!sameTarget && (propsInvalid || Object.keys(before.provider_options ?? {}).length > 0)) { setPropsKey(key => key + 1); setPropsInvalid(false) }
        setDraft({ ...draft, config })
    }

    const save = () => void act(async () => {
        if (!draft || readOnly || propsInvalid || !customProfileReady(draft.config)) return
        const detail = await apiService.saveLlmProfile(draft, systemAdmin, editing ? { id: editing.profile_id, version: editing.row_version } : undefined)
        startEditor({ name: detail.name, description: detail.description, config: structuredClone(systemAdmin ? detail.draft_config! : detail.current!.config) }, detail, false)
        setNotice(t('llmProfiles.saved')); await load()
    })

    const saveAssignments = () => void act(async () => {
        if (!preferences || !assignments) return
        try {
            const next = await apiService.saveLlmPreferences({ default_profile_id: assignments.default_profile_id, feature_profiles: assignments.feature_profiles }, preferences.row_version, systemAdmin)
            setPreferences(next); setAssignments(toAssignments(next)); setAssignmentIssues(null); setNotice(t('llmProfiles.saved'))
        } catch (failure) {
            const issues = assignmentIssuesFrom(failure)
            if (!issues) throw failure
            setAssignmentIssues(issues.general ? { ...issues, general: message(failure) } : issues)
        }
    })

    const updateAssignments = (next: LlmPreferences) => {
        setAssignments(next)
        setAssignmentIssues(before => {
            if (!before || !assignments) return before
            const features = { ...before.features }
            for (const key of Object.keys(features) as LlmFeature[]) {
                const changed = next.feature_profiles[key] !== assignments.feature_profiles[key]
                const inheritsChangedDefault = !next.feature_profiles[key] && next.default_profile_id !== assignments.default_profile_id
                if (changed || inheritsChangedDefault) delete features[key]
            }
            const defaultIssue = next.default_profile_id !== assignments.default_profile_id ? undefined : before.default
            return Object.keys(features).length || defaultIssue || before.general ? { features, default: defaultIssue, general: before.general } : null
        })
    }

    // Personal profiles can only test contracts that accept their own key.
    const testable = features.filter(feature => isLlmFeatureEnabled(feature.feature_key) && (systemAdmin || feature.user_selection_enabled && feature.byok_enabled))
    const feature = testable.some(item => item.feature_key === testFeature) ? testFeature : testable[0]?.feature_key
    // A draft test runs the saved draft version on the server, never local edits.
    const draftUnsaved = Boolean(systemAdmin && editing && draft && JSON.stringify({ name: draft.name, description: draft.description, config: draft.config })
        !== JSON.stringify({ name: editing.name, description: editing.description, config: editing.draft_config }))
    const savedConfig = editing ? systemAdmin ? editing.draft_config : editing.current?.config : undefined
    const dirty = Boolean(draft && !readOnly && (propsInvalid || !editing || draft.name !== editing.name || draft.description !== editing.description
        || configKey(draft.config) !== configKey(savedConfig)))

    const blockedFeatures = !draftUnsaved && compatibilityState.status === 'ready' && editing?.impact
        ? compatibilityState.report.features.filter(row => !row.compatible && editing.impact!.affected_features.includes(row.feature)).map(row => row.feature) : []

    const test = (kind: LlmProfileTestTarget['kind']) => void act(async () => {
        if (!editing || !feature) return
        setTestResult(null)
        const target: LlmProfileTestTarget | null = kind === 'draft' ? { kind, draftVersion: editing.row_version }
            : editing.current ? { kind, revisionId: editing.current.revision_id } : null
        if (!target) return
        // Retrying the same target and contract replays the same intent.
        const expectedOwner = owner.current
        const key = `${expectedOwner}|${editing.profile_id}|${target.kind === 'draft' ? `draft:${target.draftVersion}` : target.revisionId}|${feature}`
        const retained = testIntent.current?.key === key
        if (!retained) testIntent.current = { key, request: crypto.randomUUID() }
        const retry = testIntent.current!.nextRetry
        if (retry) testIntent.current = { key, request: crypto.randomUUID(), parent: retry.retry_of_execution_id }
        const attempt = testIntent.current!
        const requestId = testIntent.current!.request
        let rejectCredential = () => {}
        const rememberFailure = (failure: unknown) => {
            if (failure instanceof ApiError && ['BYOK_CREDENTIAL_REJECTED', 'PROVIDER_AUTHENTICATION_REJECTED'].includes(failure.code || '')) rejectCredential()
            if (failure instanceof ApiError && failure.llmRetry && owner.current === expectedOwner && testIntent.current === attempt) {
                attempt.nextRetry = { ...failure.llmRetry }
            }
        }
        const llm = systemAdmin ? undefined : retry ? await prepareRetainedLlmRequest(feature, retry)
            : await prepareLlmRequest(feature, { selection: { mode: 'profile', profile_id: editing.profile_id },
                ...(attempt.parent ? { retry_of_execution_id: attempt.parent, expected_revision_id: target.kind === 'published' ? target.revisionId : undefined } : {}) }, undefined, retained && !retry ? requestId : undefined)
        rejectCredential = credentialSession.rejectionHandler(feature)
        try {
            if (owner.current !== expectedOwner) return
            if (target.kind === 'published' && llm?.expected_revision_id && llm.expected_revision_id !== target.revisionId) throw new Error('PROFILE_REVISION_CHANGED')
            const result = await apiService.testLlmProfile(editing.profile_id, target, feature, requestId, systemAdmin, llm?.credentials, attempt.parent)
            if (owner.current !== expectedOwner) return
            testIntent.current = null
            setTestResult(result)
        } catch (failure) {
            rememberFailure(failure)
            throw failure
        } finally { if (llm) delete llm.credentials }
    })

    const validate = () => void act(async () => {
        if (!editing) return
        const result = await apiService.validateLlmProfile(editing.profile_id)
        setNotice(result.affected_features.length
            ? t('llmProfiles.editor.validAssigned', { features: result.affected_features.map(item => t(`llmProfiles.features.${item}`)).join(', ') })
            : t('llmProfiles.editor.validUnassigned'))
    })

    const rollback = (revisionId: string) => void act(async () => {
        if (!editing || !revisionId) return
        const next = await apiService.rollbackLlmProfile(editing.profile_id, revisionId, editing.row_version); setEditing(next); await load()
    })

    const loadMoreModels = () => void act(async () => {
        const page = await apiService.getLlmModels({ credential_mode: systemAdmin ? 'platform' : 'user_byok', limit: 100, offset: models.length })
        setModels(before => [...before, ...page.items]); setModelsTotal(page.total)
    })

    const copyPersonal = () => {
        if (!draft) return
        const copy = structuredClone(draft); copy.config.platform_connection_key = null
        startEditor(copy, null, false)
    }

    const closeEditor = () => {
        if (busy) return
        setDraft(null); setEditing(null); setConfirming(null); setError(''); setErrorCode(''); setTestResult(null); setPropsInvalid(false)
    }

    const confirm = () => {
        const kind = confirming
        void act(async () => {
            if (!editing) return
            try {
                if (kind === 'publish') {
                    const next = await apiService.publishLlmProfile(editing.profile_id, editing.row_version); setEditing(next)
                } else if (kind === 'archive') {
                    await apiService.archiveLlmProfile(editing.profile_id, editing.row_version, systemAdmin); setDraft(null); setEditing(null)
                }
            } finally { setConfirming(null) }
            await load()
        })
    }

    const impactCount = editing?.impact ? editing.impact.system_defaults + editing.impact.system_features + editing.impact.user_defaults + editing.impact.user_features : 0
    const confirmMessage = confirming === 'publish'
        ? [t('llmProfiles.publishImpact', { count: impactCount }),
            ...(blockedFeatures.length ? [t('llmProfiles.compatibility.publishBlocked', { features: blockedFeatures.map(item => t(`llmProfiles.features.${item}`)).join(', ') })] : [])].join(' ')
        : confirming === 'archive' ? t('llmProfiles.editor.archiveConfirm', { name: editing?.name ?? draft?.name ?? '' }) : ''

    const assignmentsDirty = Boolean(preferences && assignments && stableJson(toAssignments(preferences)) !== stableJson(assignments))

    const setAppDefault = (profileId: string) => void act(async () => {
        if (!systemAdmin || !profileId) return
        const latest = await apiService.getLlmPreferences(true)
        const next = await apiService.saveLlmPreferences({ default_profile_id: profileId, feature_profiles: latest.feature_profiles }, latest.row_version, true)
        setPreferences(next)
        // Keep unsaved per-feature edits in the table; only the default row follows the saved policy.
        setAssignments(before => before && assignmentsDirty ? { ...before, default_profile_id: next.default_profile_id } : toAssignments(next))
        setAssignmentIssues(before => before?.default ? { ...before, default: undefined } : before)
        setNotice(t('llmProfiles.page.defaultSet', { name: profiles.find(item => item.profile_id === profileId)?.name ?? '' }))
    })

    return {
        authorized, systemAdmin, loading, busy, error, notice, profiles, details, models, modelsTotal,
        hasUsableModels: usable.length > 0, connections, features, preferences, assignments, assignmentsDirty, assignmentIssues, defaultGaps,
        audit, capacityUsage, capacityError, page: { offset, total, size: PROFILE_PAGE_SIZE },
        editor: draft ? {
            mode: readOnly ? 'view' : editing ? 'edit' : 'create', draft, editing, dirty, draftUnsaved,
            compatibility: readOnly ? null : compatibilityState, propsKey, propsInvalid,
            propsServerError: errorCode === 'PROFILE_REQUEST_INVALID' && Object.keys(draft.config.provider_options ?? {}).length > 0
                ? t('llmProfiles.editor.propsServer') : undefined,
            testFeatures: testable, testFeature: feature, testResult,
        } : null,
        confirm: confirming ? { kind: confirming, message: confirmMessage } : null,
        actions: {
            refresh: () => void load(), setOffset, create, open, closeEditor,
            updateDraft: next => {
                if (draft?.config.custom_provider?.protocol !== next.config.custom_provider?.protocol) {
                    setPropsKey(key => key + 1); setPropsInvalid(false)
                }
                setDraft(next)
            }, chooseModel,
            setPropsValidity: valid => setPropsInvalid(!valid), setTestFeature, save, validate, test, rollback, loadMoreModels, copyPersonal,
            requestPublish: () => setConfirming('publish'), requestArchive: () => setConfirming('archive'), cancelConfirm: () => setConfirming(null), confirm,
            setAssignments: updateAssignments, saveAssignments, setAppDefault,
            syncCatalog: () => void act(async () => {
                const result = await apiService.syncLlmCatalog(); await load()
                setNotice(t('llmProfiles.activity.synced', { models: result.model_count, connections: result.connection_count }))
            }),
            forgetKeys: () => { credentialSession.clear(); setNotice(t('llmProfiles.key.forgotten')) },
            clearNotice: () => setNotice(''),
        },
    }
}
