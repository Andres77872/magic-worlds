import { expect, it } from 'vitest'
import { assertEffectiveLlmProfile, assertLlmCapacityUsage, assertLlmProviderUsage, assertPublicLlmData } from './llmProfileContract'

const profile = { project_hash: 'project-one', profile_id: '11111111-1111-4111-8111-111111111111', revision_id: '22222222-2222-4222-8222-222222222222',
    profile_scope: 'user', credential_mode: 'user_byok', provider_target_key: 'approved-target', platform_connection_key: null,
    resolution_source: 'explicit', catalog_revision: 'catalog-one', policy_revision: 'policy-one', roles: { primary: { catalog_model_key: 'writer', provider_model_id: 'writer-native', endpoint: 'chat_completions', settings: {
        max_input_tokens: 1024, max_output_tokens: 256, max_messages: 10, timeout_seconds: 30, truncation_strategy: 'token_budget' } } } }
it('accepts a secret-free personal effective profile', () => expect(() => assertEffectiveLlmProfile(profile)).not.toThrow())
const custom = { ...profile, provider_target_key: `custom:${profile.profile_id}`,
    custom_provider: { protocol: 'openai', base_url: 'https://provider.example/v1', endpoint: 'chat_completions' } }
it('allows the custom URL only inside the typed custom-provider descriptor', () => {
    expect(() => assertEffectiveLlmProfile(custom)).not.toThrow()
    expect(() => assertPublicLlmData({ config: { custom_provider: custom.custom_provider } })).not.toThrow()
    expect(() => assertPublicLlmData({ provider_options: { custom_provider: custom.custom_provider } })).toThrow()
    expect(() => assertPublicLlmData({ config: { custom_provider: { ...custom.custom_provider, api_key: 'FAKE_PRIVATE_CANARY' } } })).toThrow()
})
it.each(['https://localhost/v1', 'http://provider.example/v1', 'https://10.0.0.1/v1',
    'https://provider.example/v1?key=secret', 'https://provider.example/v1/responses'])('rejects an unsupported custom URL %s', base_url => {
    expect(() => assertEffectiveLlmProfile({ ...custom, custom_provider: { ...custom.custom_provider, base_url } })).toThrow()
})
it.each(['credentials', 'api_key', 'provider_key', 'headers', 'secret_ref', 'base_url', 'api_info'])('rejects nested private %s without echoing its value', key => {
    const check = () => assertPublicLlmData({ current: { config: { [key]: 'FAKE_PRIVATE_CANARY' } } })
    expect(check).toThrow('Invalid public LLM response.')
    try { check() } catch (error) { expect(String(error)).not.toContain('FAKE_PRIVATE_CANARY') }
})
it.each([
    { ...profile, profile_scope: 'system' }, { ...profile, credential_mode: 'platform' },
    { ...profile, platform_connection_key: 'foreign-connection' }, { ...profile, revision_id: 'invalid' },
    { ...profile, roles: { primary: {}, custom: {} } }, { ...profile, graph: {} },
])('rejects an ambiguous or private execution destination', value => expect(() => assertEffectiveLlmProfile(value)).toThrow())

const capacity = { usage_day: '2026-06-10', month_start: '2026-06-01', operations: [
    { operation: 'chat_interaction', features: ['chat_adventure', 'chat_group'], byok_enabled: true, app_credit_billed: true,
        today: { platform: 1, user_byok: 2, unattributed: 0 }, month: { platform: 5, user_byok: 9, unattributed: 0 } },
    { operation: 'voice_call', features: ['callbot'], byok_enabled: false, app_credit_billed: false,
        today: { platform: 0, user_byok: 0, unattributed: 0 }, month: { platform: 0, user_byok: 0, unattributed: 0 } },
] }
it('accepts zero-filled per-payer capacity usage', () => expect(() => assertLlmCapacityUsage(capacity)).not.toThrow())
it.each([
    ['extra top-level field', { ...capacity, cost: 1 }],
    ['month start outside the usage month', { ...capacity, month_start: '2026-05-01' }],
    ['missing payer bucket', { ...capacity, operations: [{ ...capacity.operations[0], today: { platform: 1, user_byok: 2 } }] }],
    ['unknown payer bucket', { ...capacity, operations: [{ ...capacity.operations[0], month: { ...capacity.operations[0].month, direct: 1 } }] }],
    ['today above the month total', { ...capacity, operations: [{ ...capacity.operations[0], today: { platform: 6, user_byok: 2, unattributed: 0 } }] }],
    ['negative or fractional count', { ...capacity, operations: [{ ...capacity.operations[0], month: { platform: 1.5, user_byok: 9, unattributed: 0 } }] }],
    ['duplicate operation', { ...capacity, operations: [capacity.operations[0], capacity.operations[0]] }],
    ['unknown feature', { ...capacity, operations: [{ ...capacity.operations[0], features: ['retired_feature'] }] }],
    ['private field', { ...capacity, operations: [{ ...capacity.operations[0], api_key: 'FAKE_PRIVATE_CANARY' }] }],
])('rejects capacity usage with %s', (_name, value) => expect(() => assertLlmCapacityUsage(value)).toThrow())

const payer = (requests: number, estimates: unknown[] = []) => ({ requests, prompt_tokens: 10, completion_tokens: 5, cached_tokens_read: 0,
    reasoning_tokens: 0, unknown_cost_calls: 0, provider_estimates: estimates })
const providerUsage = { from_date: '2026-06-01', to_date: '2026-06-19', by_payer: {
    platform: payer(4, [{ currency: 'USD', amount: '0.125', estimated_calls: 4 }]), user_byok: payer(2), unattributed: payer(0) } }
it('accepts provider estimates split by every payer', () => expect(() => assertLlmProviderUsage(providerUsage)).not.toThrow())
it.each([
    ['an extra top-level field', { ...providerUsage, app_credits: 3 }],
    ['an inverted range', { ...providerUsage, from_date: '2026-06-20' }],
    ['a missing payer', { ...providerUsage, by_payer: { platform: payer(1), user_byok: payer(1) } }],
    ['an unknown payer', { ...providerUsage, by_payer: { ...providerUsage.by_payer, direct: payer(1) } }],
    ['a fractional count', { ...providerUsage, by_payer: { ...providerUsage.by_payer, user_byok: { ...payer(1), prompt_tokens: 1.5 } } }],
    ['a numeric amount', { ...providerUsage, by_payer: { ...providerUsage.by_payer, platform: payer(4, [{ currency: 'USD', amount: 0.1, estimated_calls: 1 }]) } }],
    ['a duplicate currency', { ...providerUsage, by_payer: { ...providerUsage.by_payer, platform: payer(4, [
        { currency: 'USD', amount: '1', estimated_calls: 1 }, { currency: 'USD', amount: '2', estimated_calls: 1 }]) } }],
    ['more priced calls than requests', { ...providerUsage, by_payer: { ...providerUsage.by_payer, platform: payer(1, [{ currency: 'USD', amount: '1', estimated_calls: 2 }]) } }],
    ['a private field', { ...providerUsage, by_payer: { ...providerUsage.by_payer, user_byok: { ...payer(1), api_key: 'FAKE_PRIVATE_CANARY' } } }],
])('rejects provider usage with %s', (_name, value) => expect(() => assertLlmProviderUsage(value)).toThrow())
