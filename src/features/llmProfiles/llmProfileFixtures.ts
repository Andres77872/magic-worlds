/**
 * Storybook fixtures for the LLM profile pages: a small approved catalog, app
 * and personal profiles (summary + detail), the server feature contracts, a
 * policy, user preferences and an audit trail. Builds on llmFeatureFixtures,
 * llmCompatibilityFixtures and llmCapacityFixtures. No credentials anywhere.
 */
import type {
    LlmAuditEvent,
    LlmCatalogMetadata,
    LlmCatalogModel,
    LlmConnection,
    LlmFeatureView,
    LlmPreferencesView,
    LlmProfileConfig,
    LlmProfileDetail,
    LlmProfileSummary,
} from '@/shared/types/llmProfile.types'
import type { LlmFeature } from '@/shared/types/llm.types'
import { personalCapacityUsage } from './llmCapacityFixtures'
import { mixedCompatibility } from './llmCompatibilityFixtures'
import { applicationProfile, personalProfile } from './llmFeatureFixtures'
import { roleFor } from './llmProfileModel'
import type { LlmProfilesConsole, LlmProfilesConsoleActions, LlmProfilesEditorState } from './useLlmProfilesConsole'

const metadata: LlmCatalogMetadata = {
    provenance: { source: 'curated', source_ref: null, last_checked_at: '2026-10-01T00:00:00Z', confidence: 'reviewed' },
    tags: [], pricing: null, parameters: {}, evaluations: [], deprecated_at: null, retirement_at: null,
}
const model = (key: string, name: string, extra: Partial<LlmCatalogModel> = {}): LlmCatalogModel => ({
    catalog_model_key: key, provider_target_key: 'fixture-router', catalog_revision: 'fixture-catalog', provider_model_id: key,
    display_name: name, vendor_name: 'Fixture Labs', metadata, status: 'active', context_window: 200_000, max_output_tokens: 32_000,
    supported_parameters: ['temperature', 'top_p'], compatible_endpoints: ['chat_completions'],
    capabilities: ['chat', 'streaming', 'tools', 'json'], verified_features: [], credential_modes: ['platform', 'user_byok'], ...extra,
})

export const catalogModels: LlmCatalogModel[] = [
    model('fixture-storyteller', 'Storyteller Large', { capabilities: ['chat', 'streaming', 'tools', 'json', 'reasoning'],
        supported_parameters: ['temperature', 'top_p', 'reasoning_effort'], compatible_endpoints: ['chat_completions', 'responses'] }),
    model('fixture-swift', 'Swift Small', { context_window: 128_000, max_output_tokens: 16_000 }),
    model('fixture-scribe', 'Scribe Mini', { context_window: 32_000, max_output_tokens: 8_000, capabilities: ['chat', 'streaming'] }),
    model('fixture-legacy', 'Legacy Bard', { status: 'deprecated', capabilities: ['chat', 'streaming', 'json'] }),
]

export const fixtureConnections: LlmConnection[] = [{ connection_key: 'fixture-platform', provider_target_key: 'fixture-router', available: true }]

const settings = { max_input_tokens: 32_768, max_output_tokens: 4_096, max_messages: 100, timeout_seconds: 120, truncation_strategy: 'token_budget' as const }
export const storytellerConfig: LlmProfileConfig = {
    provider_target_key: 'fixture-router', catalog_revision: 'fixture-catalog', platform_connection_key: 'fixture-platform',
    roles: {
        primary: { catalog_model_key: 'fixture-storyteller', endpoint: 'chat_completions', settings: { ...settings, temperature: 0.9 } },
        preflight: { catalog_model_key: 'fixture-swift', endpoint: 'chat_completions', settings: { ...settings, max_output_tokens: 1_024, timeout_seconds: 30 } },
        metadata: { catalog_model_key: 'fixture-swift', endpoint: 'chat_completions', settings: { ...settings, max_output_tokens: 2_048 } },
    },
    provider_options: { provider_routing: { order: ['fast', 'cheap'] }, transforms: ['middle-out'] },
}
const swiftConfig: LlmProfileConfig = {
    provider_target_key: 'fixture-router', catalog_revision: 'fixture-catalog', platform_connection_key: 'fixture-platform',
    roles: { primary: { catalog_model_key: 'fixture-swift', endpoint: 'chat_completions', settings } },
}

export const appStoryteller: LlmProfileSummary = { ...applicationProfile, name: 'Application storyteller',
    description: 'Rich prose for roleplay, with a fast model planning and tracking each turn.', row_version: 6 }
export const appWriterDraft: LlmProfileSummary = { ...applicationProfile, profile_id: '55555555-5555-4555-8555-555555555555',
    revision_id: null, name: 'Quick card writer', description: 'Draft: a cheaper model for card generation.', status: 'draft', row_version: 2 }
export const appArchived: LlmProfileSummary = { ...applicationProfile, profile_id: '66666666-6666-4666-8666-666666666666',
    revision_id: null, name: 'Retired narrator', description: '', status: 'archived', row_version: 9 }
export const personalStoryteller: LlmProfileSummary = { ...personalProfile, description: 'My own key, tuned for long scenes.' }

const revisions = [
    { revision_id: '22222222-2222-4222-8222-222222222222', revision_number: 3, created_at: '2026-10-08T18:30:00Z' },
    { revision_id: '77777777-7777-4777-8777-777777777777', revision_number: 2, created_at: '2026-10-02T09:12:00Z' },
    { revision_id: '88888888-8888-4888-8888-888888888888', revision_number: 1, created_at: '2026-09-21T14:00:00Z' },
]
export const appStorytellerDetail: LlmProfileDetail = {
    ...appStoryteller, created_at: '2026-09-21T14:00:00Z',
    current: { revision_id: revisions[0].revision_id, revision_number: 3, publication_generation: 4, config: storytellerConfig },
    revisions, draft_config: { ...storytellerConfig, roles: { ...storytellerConfig.roles, primary: { ...storytellerConfig.roles.primary, settings: { ...settings, temperature: 1 } } } },
    impact: { system_defaults: 1, system_features: 3, user_defaults: 2, user_features: 1, affected_features: ['chat_adventure', 'chat_character', 'chat_group', 'novel'] },
}
export const appWriterDraftDetail: LlmProfileDetail = {
    ...appWriterDraft, created_at: '2026-10-09T10:00:00Z', current: null, revisions: [], draft_config: swiftConfig,
    impact: { system_defaults: 0, system_features: 0, user_defaults: 0, user_features: 0, affected_features: [] },
}
export const appArchivedDetail: LlmProfileDetail = { ...appArchived, created_at: '2026-08-01T10:00:00Z', current: null, revisions: [], draft_config: swiftConfig }
export const personalStorytellerDetail: LlmProfileDetail = {
    ...personalStoryteller, created_at: '2026-10-05T10:00:00Z',
    current: { revision_id: personalStoryteller.revision_id!, revision_number: 2, publication_generation: 2,
        config: { ...storytellerConfig, platform_connection_key: null, provider_options: {} } },
    revisions: [{ revision_id: personalStoryteller.revision_id!, revision_number: 2, created_at: '2026-10-07T10:00:00Z' }],
}
/** As the user page sees an app profile: only its published configuration. */
export const appStorytellerPublicDetail: LlmProfileDetail = {
    ...appStoryteller, created_at: appStorytellerDetail.created_at, current: appStorytellerDetail.current, revisions: [],
}

const requirement = (capabilities: string[], output = 65_536) => ({ capabilities: ['chat', ...capabilities], max_input_tokens: 262_144,
    max_output_tokens: output, max_messages: 1000, timeout_seconds: 120 })
const chatRoles = { primary: requirement(['streaming']), metadata: requirement(['tools'], 16_384), preflight: requirement(['tools'], 16_384) }
const contract = (feature: LlmFeature, roles: LlmFeatureView['roles'], requirements: LlmFeatureView['requirements'], selectable = true): LlmFeatureView =>
    ({ feature_key: feature, name: feature, operation: 'fixture', contract_revision: 'llm_features_v2', roles,
        user_selection_enabled: selectable, byok_enabled: selectable, requirements })
/** Mirrors the server's feature contracts (roles, selectability, capabilities). */
export const featureContracts: LlmFeatureView[] = [
    contract('card_generation', ['primary'], { primary: requirement(['json']) }),
    contract('card_assistant', ['primary'], { primary: requirement(['tools', 'streaming']) }),
    contract('novel', ['primary'], { primary: requirement(['streaming']) }),
    contract('chat_adventure', ['primary', 'metadata', 'preflight'], chatRoles),
    contract('chat_character', ['primary', 'metadata', 'preflight'], chatRoles),
    contract('chat_group', ['primary', 'metadata', 'preflight'], chatRoles),
    contract('lorebook_assistant', ['primary'], { primary: requirement(['tools', 'streaming']) }),
    contract('lorebook_extraction', ['primary'], { primary: requirement(['json']) }),
    contract('image_prompt', ['primary'], { primary: requirement(['json']) }, false),
    contract('theme_song_writer', ['primary'], { primary: requirement(['json']) }, false),
    contract('callbot', ['primary', 'metadata'], { primary: requirement(['streaming']), metadata: requirement(['tools'], 16_384) }, false),
]

export const appPolicy: LlmPreferencesView = {
    default_profile_id: appStoryteller.profile_id,
    feature_profiles: { chat_adventure: appStoryteller.profile_id, chat_character: appStoryteller.profile_id, chat_group: appStoryteller.profile_id },
    row_version: 12, generation: 12,
}
export const userPreferences: LlmPreferencesView = {
    default_profile_id: null, feature_profiles: { chat_adventure: personalStoryteller.profile_id }, row_version: 3, generation: 3,
}

export const auditTrail: LlmAuditEvent[] = [
    { event_id: 'a1', actor_user_id: 1, profile_id: appStoryteller.profile_id, revision_id: revisions[0].revision_id, event_type: 'profile_published',
        change_summary: { revision_number: 3 }, created_at: '2026-10-08T18:30:00Z' },
    { event_id: 'a2', actor_user_id: 1, profile_id: null, revision_id: null, event_type: 'system_policy_changed', change_summary: { feature_count: 3 },
        created_at: '2026-10-08T18:10:00Z' },
    { event_id: 'a3', actor_user_id: 1, profile_id: appWriterDraft.profile_id, revision_id: null, event_type: 'draft_updated', change_summary: {},
        created_at: '2026-10-07T11:00:00Z' },
    { event_id: 'a4', actor_user_id: 1, profile_id: null, revision_id: null, event_type: 'system_catalog_synced',
        change_summary: { model_count: 4, connection_count: 1 }, created_at: '2026-10-07T10:00:00Z' },
]

const noop = () => {}
const noActions: LlmProfilesConsoleActions = {
    refresh: noop, setOffset: noop, create: noop, open: noop, closeEditor: noop, updateDraft: noop, chooseModel: noop, setPropsValidity: noop,
    setTestFeature: noop, save: noop, validate: noop, test: noop, rollback: noop, loadMoreModels: noop, copyPersonal: noop,
    requestPublish: noop, requestArchive: noop, cancelConfirm: noop, confirm: noop, setAssignments: noop, saveAssignments: noop,
    setAppDefault: noop, syncCatalog: noop, forgetKeys: noop, clearNotice: noop,
}

/** Editor state for a saved profile, as the page would open it. */
export function editorFor(detail: LlmProfileDetail, systemAdmin: boolean): LlmProfilesEditorState {
    const view = !systemAdmin && detail.scope === 'system'
    const config = systemAdmin ? detail.draft_config! : detail.current!.config
    return {
        mode: view ? 'view' : 'edit', draft: { name: detail.name, description: detail.description, config: structuredClone(config) },
        editing: detail, dirty: false, draftUnsaved: false, compatibility: view ? null : { status: 'ready', report: mixedCompatibility },
        propsKey: 0, propsInvalid: false, testFeatures: featureContracts.filter(item => systemAdmin || item.user_selection_enabled && item.byok_enabled),
        testFeature: 'chat_adventure', testResult: null,
    }
}

/** A new profile starting from the first catalog model. */
export function newEditor(systemAdmin: boolean): LlmProfilesEditorState {
    const first = catalogModels[0]
    return {
        mode: 'create', editing: null, dirty: true, draftUnsaved: false, compatibility: { status: 'checking', report: null },
        draft: { name: '', description: '', config: { provider_target_key: first.provider_target_key, catalog_revision: first.catalog_revision,
            platform_connection_key: systemAdmin ? fixtureConnections[0].connection_key : null, roles: { primary: roleFor(first) } } },
        propsKey: 0, propsInvalid: false, testFeatures: [], testFeature: undefined, testResult: null,
    }
}

const rootProfiles = [appStoryteller, appWriterDraft, appArchived]
const userProfiles = [personalStoryteller, appStoryteller]

/** Everything the root "LLM profiles" page renders, with no-op actions. */
export function rootConsole(overrides: Partial<LlmProfilesConsole> = {}): LlmProfilesConsole {
    return {
        systemAdmin: true, loading: false, busy: false, error: '', notice: '', profiles: rootProfiles,
        details: { [appStoryteller.profile_id]: appStorytellerDetail, [appWriterDraft.profile_id]: appWriterDraftDetail, [appArchived.profile_id]: appArchivedDetail },
        models: catalogModels, modelsTotal: catalogModels.length, hasUsableModels: true, connections: fixtureConnections, features: featureContracts,
        preferences: appPolicy, assignments: { default_profile_id: appPolicy.default_profile_id, feature_profiles: { ...appPolicy.feature_profiles } },
        assignmentsDirty: false, assignmentIssues: null, defaultGaps: ['image_prompt'], audit: auditTrail, capacityUsage: null, capacityError: '',
        page: { offset: 0, total: rootProfiles.length, size: 25 }, editor: null, confirm: null, actions: noActions, ...overrides,
    }
}

/** Everything the user "Models and profiles" page renders, with no-op actions. */
export function userConsole(overrides: Partial<LlmProfilesConsole> = {}): LlmProfilesConsole {
    return {
        ...rootConsole(), systemAdmin: false, profiles: userProfiles,
        details: { [personalStoryteller.profile_id]: personalStorytellerDetail, [appStoryteller.profile_id]: appStorytellerPublicDetail },
        connections: [], preferences: userPreferences,
        assignments: { default_profile_id: userPreferences.default_profile_id, feature_profiles: { ...userPreferences.feature_profiles } },
        defaultGaps: [], audit: [], capacityUsage: personalCapacityUsage, page: { offset: 0, total: userProfiles.length, size: 25 }, ...overrides,
    }
}
