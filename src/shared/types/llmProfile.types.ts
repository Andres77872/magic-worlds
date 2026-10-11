import type { LlmCredentialMode, LlmFeature, LlmExecutionProvenance } from './llm.types'

export type LlmRole = 'primary' | 'metadata' | 'preflight'
export interface LlmSettings {
    max_input_tokens: number
    max_output_tokens: number
    max_messages: number
    timeout_seconds: number
    truncation_strategy: 'tail' | 'token_budget'
    temperature?: number | null
    top_p?: number | null
    reasoning_effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | null
}
export interface LlmProfileRole {
    catalog_model_key: string
    endpoint: 'chat_completions' | 'responses'
    settings: LlmSettings
}
export interface LlmProfileConfig {
    provider_target_key: string
    catalog_revision: string
    platform_connection_key: string | null
    roles: Partial<Record<LlmRole, LlmProfileRole>> & { primary: LlmProfileRole }
    /**
     * Custom provider request fields sent with every call (an object of at most
     * 16 keys / 4 KB; keys `^[a-z][a-z0-9_]{0,63}$`; reserved fields and `{{`/`}}`
     * are rejected by the server). Omitted or `{}` when none.
     */
    provider_options?: Record<string, unknown>
}
export interface LlmProfileMutation {
    name: string
    description: string
    config: LlmProfileConfig
}
export interface LlmProfileSummary {
    profile_id: string
    scope: 'system' | 'user'
    name: string
    description: string
    status: 'draft' | 'active' | 'archived'
    row_version: number
    updated_at: string
    revision_id?: string | null
    publication_generation?: number | null
}
export interface LlmProfileDetail extends LlmProfileSummary {
    created_at: string
    current: { revision_id: string; revision_number: number; publication_generation: number; config: LlmProfileConfig } | null
    revisions: { revision_id: string; revision_number: number; created_at: string }[]
    draft_config?: LlmProfileConfig
    impact?: { system_defaults: number; system_features: number; user_defaults: number; user_features: number; affected_features: LlmFeature[] }
}
export interface LlmPage<T> { items: T[]; total: number; limit: number; offset: number }
export interface LlmPreferences {
    default_profile_id: string | null
    feature_profiles: Partial<Record<LlmFeature, string>>
}
export interface LlmPreferencesView extends LlmPreferences { row_version: number; generation: number }
export interface LlmFeatureView {
    feature_key: LlmFeature
    name: string
    operation: string
    contract_revision: string
    roles: LlmRole[]
    user_selection_enabled: boolean
    byok_enabled: boolean
    requirements: Partial<Record<LlmRole, { capabilities: string[]; max_input_tokens: number; max_output_tokens: number; max_messages: number; timeout_seconds: number }>>
}
export interface LlmPriceQuote {
    pricing_revision: string
    currency: string
    unit: 'per_million_tokens'
    source_ref: string
    checked_at: string
    input_rate: string
    output_rate: string
    cached_read_rate: string | null
    cached_write_rate: string | null
}
export interface LlmCatalogMetadata {
    provenance: {
        source: 'official_documentation' | 'adapter_evaluation' | 'curated' | 'unknown'
        source_ref: string | null
        last_checked_at: string | null
        confidence: 'verified' | 'reviewed' | 'unverified'
    }
    tags: string[]
    pricing: LlmPriceQuote | null
    parameters: Partial<Record<'temperature' | 'top_p' | 'reasoning_effort', {
        minimum: number | null
        maximum: number | null
        allowed_values: string[]
        exclusive_with: string[]
    }>>
    evaluations: {
        feature: string
        status: 'verified' | 'unsupported' | 'unverified'
        contract_revision: string
        artifact_ref: string
        checked_at: string
        reason_codes: string[]
    }[]
    deprecated_at: string | null
    retirement_at: string | null
}
export interface LlmCatalogModel {
    catalog_model_key: string
    provider_target_key: string
    catalog_revision: string
    provider_model_id: string
    display_name: string
    vendor_name: string | null
    metadata: LlmCatalogMetadata
    status: 'active' | 'deprecated' | 'retired' | 'blocked'
    context_window: number
    max_output_tokens: number
    supported_parameters: string[]
    compatible_endpoints: ('chat_completions' | 'responses')[]
    capabilities: string[]
    verified_features: LlmFeature[]
    credential_modes: LlmCredentialMode[]
}
export interface LlmConnection { connection_key: string; provider_target_key: string; available: boolean }
export interface EffectiveLlmProfile {
    project_hash: string
    profile_id: string
    revision_id: string
    profile_scope: 'system' | 'user'
    resolution_source: LlmExecutionProvenance['resolution_source']
    credential_mode: LlmCredentialMode
    provider_target_key: string
    platform_connection_key: string | null
    catalog_revision: string
    policy_revision: string
    roles: Partial<Record<LlmRole, LlmProfileRole & { provider_model_id: string; price_quote: LlmPriceQuote | null }>> & { primary: LlmProfileRole & { provider_model_id: string; price_quote: LlmPriceQuote | null } }
}
/** A published revision, or (root only) the exact saved draft version of a system profile. */
export type LlmProfileTestTarget = { kind: 'published'; revisionId: string } | { kind: 'draft'; draftVersion: number }
export interface LlmExecutionState {
    execution_id: string
    request_id: string
    status: 'admitted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_credential'
    recovery_required: boolean
}
export interface LlmProfileTestResult {
    execution_id: string
    profile_id: string
    /** For a draft test: the unpublishable revision that froze the tested draft version. */
    revision_id: string
    payer_mode: LlmCredentialMode
    feature: LlmFeature
    /** Every role of the feature contract, each of which answered once. */
    roles: LlmRole[]
    target: LlmProfileTestTarget['kind']
    replayed: boolean
    /** The primary reply; helper roles' replies stay private in the executor. */
    output: string
}
export interface LlmAuditEvent {
    event_id: string
    actor_user_id: number
    profile_id: string | null
    revision_id: string | null
    event_type: string
    change_summary: Record<string, number | string | string[]>
    created_at: string
}
/** Admitted requests per payer; `unattributed` only holds converted history without a verifiable payer. */
export interface LlmPayerRequestCounts {
    platform: number
    user_byok: number
    unattributed: number
}
export interface LlmOperationCapacityUsage {
    operation: string
    features: LlmFeature[]
    byok_enabled: boolean
    app_credit_billed: boolean
    today: LlmPayerRequestCounts
    month: LlmPayerRequestCounts
}
/** `GET /llm/capacity-usage`: the caller's own project/group request counts, today and month to date (UTC). */
export interface LlmCapacityUsage {
    usage_day: string
    month_start: string
    operations: LlmOperationCapacityUsage[]
}
/** A fixed reason code, optionally naming the profile role that blocks the configuration or feature. */
export interface LlmCompatibilityIssue {
    code: string
    role: LlmRole | null
}
export interface LlmFeatureCompatibility {
    feature: LlmFeature
    /** The roles this feature contract uses. */
    roles: LlmRole[]
    compatible: boolean
    issue: LlmCompatibilityIssue | null
}
/** Server-computed compatibility of an unsaved configuration; personal checks list only contracts that accept the user's key. */
export interface LlmProfileCompatibility {
    configuration_issue: LlmCompatibilityIssue | null
    features: LlmFeatureCompatibility[]
}

/** A provider-side estimate in one currency; never app credits. */
export interface LlmProviderCostEstimate {
    currency: string
    /** Exact decimal string, as the executor priced it. */
    amount: string
    estimated_calls: number
}
export interface LlmPayerProviderUsage {
    requests: number
    prompt_tokens: number
    completion_tokens: number
    cached_tokens_read: number
    reasoning_tokens: number
    /** Calls with no frozen price: their cost is unknown, not zero. */
    unknown_cost_calls: number
    provider_estimates: LlmProviderCostEstimate[]
}
/** Root view of this project's provider usage; BYOK estimates are billed by the user's own provider account. */
export interface LlmProviderUsage {
    from_date: string
    to_date: string
    by_payer: Record<'platform' | 'user_byok' | 'unattributed', LlmPayerProviderUsage>
}
