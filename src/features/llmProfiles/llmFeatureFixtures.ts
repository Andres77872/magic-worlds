import type { EffectiveLlmProfile, LlmFeatureView, LlmProfileSummary } from '@/shared/types/llmProfile.types'
import type { LlmFeature } from '@/shared/types/llm.types'

const role = { catalog_model_key: 'fixture-writer', provider_model_id: 'Fixture writer', price_quote: null, endpoint: 'chat_completions' as const,
    settings: { max_input_tokens: 2000, max_output_tokens: 200, max_messages: 10, timeout_seconds: 30, truncation_strategy: 'token_budget' as const } }
export const applicationProfile: LlmProfileSummary = {
    profile_id: '11111111-1111-4111-8111-111111111111', revision_id: '22222222-2222-4222-8222-222222222222',
    name: 'Application storyteller', description: 'Storybook fixture', scope: 'system', status: 'active', row_version: 1, updated_at: '2026-10-09T00:00:00Z',
}
export const personalProfile: LlmProfileSummary = { ...applicationProfile, profile_id: '33333333-3333-4333-8333-333333333333',
    revision_id: '44444444-4444-4444-8444-444444444444', scope: 'user', name: 'My storyteller' }
export const applicationEffective: EffectiveLlmProfile = {
    project_hash: 'fixture-project', profile_id: applicationProfile.profile_id, revision_id: applicationProfile.revision_id!,
    profile_scope: 'system', resolution_source: 'system_feature', credential_mode: 'platform', provider_target_key: 'fixture-approved-target',
    platform_connection_key: 'fixture-connection', catalog_revision: 'fixture-catalog', policy_revision: 'fixture-policy',
    roles: { primary: role, metadata: { ...role, provider_model_id: 'Fixture metadata model' }, preflight: { ...role, provider_model_id: 'Fixture context model' } },
}
export const personalEffective: EffectiveLlmProfile = { ...applicationEffective, profile_id: personalProfile.profile_id,
    revision_id: personalProfile.revision_id!, profile_scope: 'user', resolution_source: 'explicit', credential_mode: 'user_byok', platform_connection_key: null }
export function featureFixture(feature: LlmFeature, selectable = true): LlmFeatureView {
    return { feature_key: feature, name: feature, operation: 'fixture', contract_revision: 'fixture-contract',
        roles: ['primary', 'metadata', 'preflight'], user_selection_enabled: selectable, byok_enabled: selectable, requirements: {} }
}
