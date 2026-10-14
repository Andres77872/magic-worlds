/**
 * Pure helpers for the LLM profile screens: role defaults, feature grouping,
 * where a profile is used, stable config comparison, custom provider props
 * validation (mirrors the server rules) and assignment-error mapping.
 */
import type { TFunction } from 'i18next'
import { ApiError } from '@/infrastructure/api'
import type { LlmFeature } from '@/shared/types/llm.types'
import type { SelectOption } from '@/ui/primitives'
import type {
    LlmCatalogModel,
    LlmFeatureView,
    LlmPreferences,
    LlmProfileConfig,
    LlmProfileRole,
    LlmRole,
} from '@/shared/types/llmProfile.types'

/** Display order: the reply, then what runs before it, then what runs after it. */
export const ROLE_ORDER: readonly LlmRole[] = ['primary', 'preflight', 'metadata']
/** Roles that only roleplay chats and voice call use. */
export const HELPER_ROLES: readonly Exclude<LlmRole, 'primary'>[] = ['preflight', 'metadata']

/** Default role settings for a catalog model (unchanged from the original console). */
export function roleFor(model: LlmCatalogModel): LlmProfileRole {
    return { catalog_model_key: model.catalog_model_key, endpoint: model.compatible_endpoints[0],
        settings: { max_input_tokens: Math.max(1, Math.min(32768, model.context_window - Math.min(4096, model.max_output_tokens) - 1024)),
            max_output_tokens: Math.min(4096, model.max_output_tokens), max_messages: 100, timeout_seconds: 120, truncation_strategy: 'token_budget' } }
}

/** A model a new profile can start from. */
export function usableModels(models: LlmCatalogModel[]): LlmCatalogModel[] {
    return models.filter(model => model.status === 'active' && model.compatible_endpoints.length > 0)
}

export type FeatureGroupKey = 'roleplay' | 'voice' | 'creation' | 'writing' | 'media' | 'other'

const GROUPS: { key: Exclude<FeatureGroupKey, 'other'>; features: LlmFeature[] }[] = [
    { key: 'roleplay', features: ['chat_adventure', 'chat_character', 'chat_group'] },
    { key: 'voice', features: ['callbot', 'moderation'] },
    { key: 'creation', features: ['card_generation', 'card_assistant', 'lorebook_assistant', 'lorebook_extraction'] },
    { key: 'writing', features: ['novel'] },
    { key: 'media', features: ['image_prompt', 'theme_song_writer'] },
]

/** Features in reading order, grouped by what they do. Unknown future features land in `other`. */
export function groupFeatures(features: LlmFeatureView[]): { key: FeatureGroupKey; features: LlmFeatureView[] }[] {
    const byKey = new Map(features.map(feature => [feature.feature_key, feature]))
    const known = new Set(GROUPS.flatMap(group => group.features))
    const groups: { key: FeatureGroupKey; features: LlmFeatureView[] }[] = GROUPS
        .map(group => ({ key: group.key, features: group.features.flatMap(key => byKey.get(key) ?? []) }))
    groups.push({ key: 'other', features: features.filter(feature => !known.has(feature.feature_key)) })
    return groups.filter(group => group.features.length > 0)
}

/** The extra roles (beyond the response model) a feature contract uses, in display order. */
export function helperRolesOf(roles: readonly LlmRole[]): Exclude<LlmRole, 'primary'>[] {
    return HELPER_ROLES.filter(role => roles.includes(role))
}

export interface ProfileUsage { isDefault: boolean; features: LlmFeature[] }

/** Where a profile is assigned in a saved preference map. */
export function profileUsage(profileId: string, preferences: LlmPreferences | null | undefined): ProfileUsage {
    if (!preferences) return { isDefault: false, features: [] }
    return {
        isDefault: preferences.default_profile_id === profileId,
        features: (Object.entries(preferences.feature_profiles) as [LlmFeature, string | undefined][])
            .filter(([, id]) => id === profileId).map(([feature]) => feature),
    }
}

function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
            .map(key => [key, stable((value as Record<string, unknown>)[key])]))
    }
    return value
}

/** JSON with object keys sorted, for order-independent comparison. */
export function stableJson(value: unknown): string {
    return JSON.stringify(stable(value))
}

/** Order-independent identity of a configuration; an empty `provider_options` equals none. */
export function configKey(config: LlmProfileConfig | null | undefined): string {
    if (!config) return ''
    const { provider_options: options, ...rest } = config
    return JSON.stringify(stable(options && Object.keys(options).length > 0 ? { ...rest, provider_options: options } : rest))
}

export function providerOptionCount(config: LlmProfileConfig | null | undefined): number {
    return config?.provider_options ? Object.keys(config.provider_options).length : 0
}

/** Returns the config with `provider_options` set, or removed when empty. */
export function withProviderOptions(config: LlmProfileConfig, options: Record<string, unknown> | undefined): LlmProfileConfig {
    const next = { ...config }
    if (options && Object.keys(options).length > 0) next.provider_options = options
    else delete next.provider_options
    return next
}

// Mirrors magic-worlds-api RESERVED_PROVIDER_OPTIONS (fields owned by the graph or the transport).
const SERVER_RESERVED = ['model', 'messages', 'stream', 'stream_options', 'tools', 'tool_choice', 'functions', 'function_call',
    'parallel_tool_calls', 'response_format', 'json_mode', 'json_output', 'max_tokens', 'max_completion_tokens',
    'temperature', 'top_p', 'reasoning_effort', 'reasoning', 'n', 'user', 'engine', 'endpoint', 'api_key',
    'private_key', 'base_url', 'headers', 'extra_headers', 'extra_body', 'callback', 'fallback', 'timeout',
    'organization', 'project']
// The client refuses to send these anywhere in a profile payload (see llmProfileContract).
export const CLIENT_PRIVATE = ['credentials', 'api_key', 'provider_key', 'secret', 'secret_ref', 'secret_alias',
    'base_url', 'url', 'headers', 'authorization', 'api_info', 'env', 'graph', 'agt', '__proto__', 'constructor']
const RESERVED_KEYS = new Set([...SERVER_RESERVED, ...CLIENT_PRIVATE])
const PRIVATE_KEYS = new Set(CLIENT_PRIVATE)
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
export const MAX_PROVIDER_OPTIONS = 16
export const MAX_PROVIDER_OPTIONS_BYTES = 4096

export type ProviderOptionsIssue =
    | { code: 'syntax' } | { code: 'notObject' } | { code: 'tooMany' } | { code: 'tooLarge' } | { code: 'tooDeep' }
    | { code: 'placeholder' } | { code: 'value' }
    | { code: 'key'; key: string } | { code: 'reserved'; key: string }

export type ProviderOptionsResult = { ok: true; value: Record<string, unknown> } | { ok: false; issue: ProviderOptionsIssue }

function checkValue(value: unknown, depth: number): ProviderOptionsIssue | null {
    if (depth > 5) return { code: 'tooDeep' }
    if (Array.isArray(value)) {
        for (const item of value) { const issue = checkValue(item, depth + 1); if (issue) return issue }
        return null
    }
    if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            if (key.includes('{{') || key.includes('}}')) return { code: 'placeholder' }
            if (PRIVATE_KEYS.has(key.toLowerCase())) return { code: 'reserved', key }
            const issue = checkValue(item, depth + 1)
            if (issue) return issue
        }
        return null
    }
    if (typeof value === 'string') return value.includes('{{') || value.includes('}}') ? { code: 'placeholder' } : null
    if (typeof value === 'number') return Number.isFinite(value) ? null : { code: 'value' }
    return value === null || typeof value === 'boolean' ? null : { code: 'value' }
}

/**
 * Parses the custom provider props text. Empty text means "none". `reserved`
 * defaults to the LLM transport's fields; image profiles pass their own.
 */
export function parseProviderOptions(text: string, reserved: ReadonlySet<string> = RESERVED_KEYS): ProviderOptionsResult {
    if (!text.trim()) return { ok: true, value: {} }
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { return { ok: false, issue: { code: 'syntax' } } }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, issue: { code: 'notObject' } }
    const record = parsed as Record<string, unknown>
    const keys = Object.keys(record)
    if (keys.length > MAX_PROVIDER_OPTIONS) return { ok: false, issue: { code: 'tooMany' } }
    for (const key of keys) {
        if (reserved.has(key)) return { ok: false, issue: { code: 'reserved', key } }
        if (!KEY_PATTERN.test(key)) return { ok: false, issue: { code: 'key', key } }
    }
    for (const key of keys) {
        const issue = checkValue(record[key], 1)
        if (issue) return { ok: false, issue }
    }
    if (new TextEncoder().encode(JSON.stringify(record)).length > MAX_PROVIDER_OPTIONS_BYTES) return { ok: false, issue: { code: 'tooLarge' } }
    return { ok: true, value: record }
}

export function formatProviderOptions(options: Record<string, unknown> | undefined): string {
    return options && Object.keys(options).length > 0 ? JSON.stringify(options, null, 2) : ''
}

const CAPABILITY_KEYS = new Set(['chat', 'streaming', 'tools', 'json', 'json_schema', 'vision', 'reasoning', 'agent'])

/** Human label for a model capability; unknown ones are shown as their code. */
export function capabilityLabel(capability: string, t: TFunction): string {
    return CAPABILITY_KEYS.has(capability) ? t(`llmProfiles.capabilities.${capability}`) : capability.replace(/_/g, ' ')
}

/** Options for a model picker; a saved model missing from the loaded catalog stays visible but disabled. */
export function modelOptions(models: LlmCatalogModel[], t: TFunction, locale: string | undefined, selectedKey?: string): SelectOption[] {
    const options: SelectOption[] = models.map(model => ({
        value: model.catalog_model_key, label: model.display_name, textValue: model.display_name,
        description: [model.vendor_name ?? model.provider_target_key,
            t('llmProfiles.editor.context', { value: formatTokens(model.context_window, locale) }),
            model.capabilities.filter(capability => capability !== 'chat').map(capability => capabilityLabel(capability, t)).join(', ')]
            .filter(Boolean).join(' · '),
        disabled: model.status === 'retired' || model.status === 'blocked',
    }))
    if (selectedKey && !models.some(model => model.catalog_model_key === selectedKey)) {
        options.unshift({ value: selectedKey, label: selectedKey, disabled: true })
    }
    return options
}

/** Compact token count, e.g. 128K. */
export function formatTokens(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Why the server refused an assignment, per row. */
export interface AssignmentIssue { code: string; role: LlmRole | null }
export interface AssignmentIssues {
    default?: AssignmentIssue
    features: Partial<Record<LlmFeature, AssignmentIssue>>
    /** An error that is not about a single row (a fixed code; the page swaps it for a message). */
    general?: string
}

function issueOf(value: unknown): { feature?: LlmFeature; issue: AssignmentIssue } | null {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    if (typeof record.code !== 'string') return null
    const role = record.role === 'primary' || record.role === 'metadata' || record.role === 'preflight' ? record.role : null
    return { feature: typeof record.feature === 'string' ? record.feature as LlmFeature : undefined, issue: { code: record.code, role } }
}

/** Maps a failed preference/policy save to the rows it concerns; null for non-API failures. */
export function assignmentIssuesFrom(failure: unknown): AssignmentIssues | null {
    if (!(failure instanceof ApiError) || !failure.code) return null
    const result: AssignmentIssues = { features: {} }
    if (failure.code === 'SYSTEM_DEFAULT_REQUIRED') {
        result.default = { code: failure.code, role: null }
        return result
    }
    const details = failure.details ?? {}
    const listed = Array.isArray(details.issues) ? details.issues : [details]
    for (const entry of listed) {
        const parsed = issueOf(entry)
        if (parsed?.feature) result.features[parsed.feature] = parsed.issue
    }
    if (Object.keys(result.features).length === 0) result.general = failure.code
    return result
}
