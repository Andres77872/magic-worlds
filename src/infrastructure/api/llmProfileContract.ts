/** Reject private configuration before any profile response reaches application state. */
const PRIVATE_FIELDS = new Set([
    'credentials', 'api_key', 'provider_key', 'secret', 'secret_ref', 'secret_alias',
    'base_url', 'url', 'headers', 'authorization', 'api_info', 'env', 'graph', 'agt',
])

export function assertPublicLlmData(value: unknown): void {
    let nodes = 0
    const visit = (item: unknown, depth: number): void => {
        if (++nodes > 30_000 || depth > 16) throw new Error('Invalid public LLM response.')
        if (item === null || typeof item === 'boolean') return
        if (typeof item === 'string' && item.length <= 16_384) return
        if (typeof item === 'number' && Number.isFinite(item)) return
        if (Array.isArray(item)) {
            item.forEach(child => visit(child, depth + 1))
            return
        }
        if (typeof item !== 'object' || item === null) throw new Error('Invalid public LLM response.')
        for (const [key, child] of Object.entries(item)) {
            if (PRIVATE_FIELDS.has(key.toLowerCase()) || key === '__proto__' || key === 'constructor') {
                throw new Error('Invalid public LLM response.')
            }
            visit(child, depth + 1)
        }
    }
    visit(value, 0)
}

export function assertEffectiveLlmProfile(value: unknown): void {
    assertPublicLlmData(value)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid effective LLM profile.')
    const data = value as Record<string, unknown>
    const required = ['project_hash', 'profile_id', 'revision_id', 'profile_scope', 'resolution_source', 'credential_mode',
        'provider_target_key', 'platform_connection_key', 'catalog_revision', 'policy_revision', 'roles']
    if (Object.keys(data).length !== required.length || required.some(key => !(key in data))) {
        throw new Error('Invalid effective LLM profile.')
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof data.profile_id !== 'string' || !uuid.test(data.profile_id)
        || typeof data.project_hash !== 'string' || !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(data.project_hash)
        || typeof data.revision_id !== 'string' || !uuid.test(data.revision_id)
        || typeof data.provider_target_key !== 'string' || !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(data.provider_target_key)
        || !['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(String(data.resolution_source))
        || !(data.profile_scope === 'system' && data.credential_mode === 'platform' && typeof data.platform_connection_key === 'string'
            || data.profile_scope === 'user' && data.credential_mode === 'user_byok' && data.platform_connection_key === null)
        || !data.roles || typeof data.roles !== 'object' || Array.isArray(data.roles)
        || !('primary' in data.roles) || Object.keys(data.roles).some(role => !['primary', 'metadata', 'preflight'].includes(role))) {
        throw new Error('Invalid effective LLM profile.')
    }
    const identifier = /^[A-Za-z0-9_.:@/-]{1,128}$/
    if (![data.catalog_revision, data.policy_revision].every(item => typeof item === 'string' && identifier.test(item))
        || data.platform_connection_key !== null && (typeof data.platform_connection_key !== 'string' || !identifier.test(data.platform_connection_key))) {
        throw new Error('Invalid effective LLM profile.')
    }
    for (const item of Object.values(data.roles)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid effective LLM profile.')
        const role = item as Record<string, unknown>
        // `price_quote` (catalog pricing, or null) accompanies every resolved role.
        if (Object.keys(role).length !== ('price_quote' in role ? 5 : 4)
            || !['catalog_model_key', 'provider_model_id', 'settings', 'endpoint'].every(key => key in role)
            || role.price_quote != null && (typeof role.price_quote !== 'object' || Array.isArray(role.price_quote))
            || typeof role.catalog_model_key !== 'string' || !identifier.test(role.catalog_model_key)
            || typeof role.provider_model_id !== 'string' || role.provider_model_id.length < 1 || role.provider_model_id.length > 256
            || !['chat_completions', 'responses'].includes(String(role.endpoint))
            || !role.settings || typeof role.settings !== 'object' || Array.isArray(role.settings)) throw new Error('Invalid effective LLM profile.')
        const settings = role.settings as Record<string, unknown>
        const limits = { max_input_tokens: 2_000_000, max_output_tokens: 131_072, max_messages: 1000 }
        for (const [key, maximum] of Object.entries(limits)) {
            if (!Number.isSafeInteger(settings[key]) || Number(settings[key]) < 1 || Number(settings[key]) > maximum) throw new Error('Invalid effective LLM profile.')
        }
        const allowed = ['temperature', 'top_p', 'reasoning_effort', 'max_input_tokens', 'max_output_tokens', 'max_messages', 'timeout_seconds', 'truncation_strategy']
        if (Object.keys(settings).some(key => !allowed.includes(key))
            || typeof settings.timeout_seconds !== 'number' || settings.timeout_seconds <= 0 || settings.timeout_seconds > 600
            || !['tail', 'token_budget'].includes(String(settings.truncation_strategy))
            || settings.temperature != null && (typeof settings.temperature !== 'number' || settings.temperature < 0 || settings.temperature > 2)
            || settings.top_p != null && (typeof settings.top_p !== 'number' || settings.top_p <= 0 || settings.top_p > 1)
            || settings.reasoning_effort != null && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(String(settings.reasoning_effort))) {
            throw new Error('Invalid effective LLM profile.')
        }
    }
}

const LLM_FEATURES = new Set(['card_generation', 'card_assistant', 'novel', 'chat_adventure', 'chat_character', 'chat_group',
    'lorebook_assistant', 'lorebook_extraction', 'image_prompt', 'theme_song_writer', 'callbot'])
const PAYER_COUNT_KEYS = ['platform', 'user_byok', 'unattributed']

function hasExactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === keys.length && keys.every(key => key in value)
}

/** Reject capacity usage that is not exactly the zero-filled per-operation, per-payer contract. */
export function assertLlmCapacityUsage(value: unknown): void {
    assertPublicLlmData(value)
    const invalid = () => new Error('Invalid LLM capacity usage.')
    if (!hasExactKeys(value, ['usage_day', 'month_start', 'operations'])) throw invalid()
    const day = /^\d{4}-\d{2}-\d{2}$/
    if (typeof value.usage_day !== 'string' || !day.test(value.usage_day)
        || typeof value.month_start !== 'string' || value.month_start !== `${value.usage_day.slice(0, 8)}01`
        || !Array.isArray(value.operations) || value.operations.length > 32) throw invalid()
    const seen = new Set<string>()
    for (const item of value.operations) {
        if (!hasExactKeys(item, ['operation', 'features', 'byok_enabled', 'app_credit_billed', 'today', 'month'])
            || typeof item.operation !== 'string' || !/^[a-z0-9_]{1,64}$/.test(item.operation) || seen.has(item.operation)
            || !Array.isArray(item.features) || item.features.length === 0
            || item.features.some(feature => typeof feature !== 'string' || !LLM_FEATURES.has(feature))
            || typeof item.byok_enabled !== 'boolean' || typeof item.app_credit_billed !== 'boolean') throw invalid()
        seen.add(item.operation)
        for (const period of [item.today, item.month]) {
            if (!hasExactKeys(period, PAYER_COUNT_KEYS)
                || PAYER_COUNT_KEYS.some(key => !Number.isSafeInteger(period[key]) || Number(period[key]) < 0)) throw invalid()
        }
        const today = item.today as Record<string, number>
        const month = item.month as Record<string, number>
        if (PAYER_COUNT_KEYS.some(key => today[key] > month[key])) throw invalid()
    }
}

const LLM_ROLES = new Set(['primary', 'metadata', 'preflight'])
const ISSUE_CODE = /^[A-Za-z0-9_.:@/-]{1,128}$/

function isIssue(value: unknown): boolean {
    return hasExactKeys(value, ['code', 'role']) && typeof value.code === 'string' && ISSUE_CODE.test(value.code)
        && (value.role === null || typeof value.role === 'string' && LLM_ROLES.has(value.role))
}

/** Reject a compatibility report that is not exactly validity plus one row per known feature contract. */
export function assertLlmProfileCompatibility(value: unknown): void {
    assertPublicLlmData(value)
    const invalid = () => new Error('Invalid LLM profile compatibility.')
    if (!hasExactKeys(value, ['configuration_issue', 'features']) || !Array.isArray(value.features)
        || value.configuration_issue !== null && !isIssue(value.configuration_issue)
        || value.configuration_issue !== null && value.features.length > 0) throw invalid()
    const seen = new Set<string>()
    for (const row of value.features) {
        if (!hasExactKeys(row, ['feature', 'roles', 'compatible', 'issue']) || typeof row.feature !== 'string'
            || !LLM_FEATURES.has(row.feature) || seen.has(row.feature) || typeof row.compatible !== 'boolean'
            || !Array.isArray(row.roles) || row.roles[0] !== 'primary' || new Set(row.roles).size !== row.roles.length
            || row.roles.some(role => typeof role !== 'string' || !LLM_ROLES.has(role))
            || (row.compatible ? row.issue !== null : !isIssue(row.issue))) throw invalid()
        seen.add(row.feature)
    }
}

const PROVIDER_USAGE_COUNTS = ['requests', 'prompt_tokens', 'completion_tokens', 'cached_tokens_read', 'reasoning_tokens', 'unknown_cost_calls']

/** Reject provider usage that is not exactly per-payer totals with currency-tagged decimal estimates. */
export function assertLlmProviderUsage(value: unknown): void {
    assertPublicLlmData(value)
    const invalid = () => new Error('Invalid LLM provider usage.')
    const day = /^\d{4}-\d{2}-\d{2}$/
    if (!hasExactKeys(value, ['from_date', 'to_date', 'by_payer']) || typeof value.from_date !== 'string' || !day.test(value.from_date)
        || typeof value.to_date !== 'string' || !day.test(value.to_date) || value.from_date > value.to_date
        || !hasExactKeys(value.by_payer, PAYER_COUNT_KEYS)) throw invalid()
    for (const payer of PAYER_COUNT_KEYS) {
        const usage = value.by_payer[payer]
        if (!hasExactKeys(usage, [...PROVIDER_USAGE_COUNTS, 'provider_estimates'])
            || PROVIDER_USAGE_COUNTS.some(key => !Number.isSafeInteger(usage[key]) || Number(usage[key]) < 0)
            || !Array.isArray(usage.provider_estimates) || usage.provider_estimates.length > 16) throw invalid()
        const currencies = new Set<string>()
        for (const estimate of usage.provider_estimates) {
            if (!hasExactKeys(estimate, ['currency', 'amount', 'estimated_calls'])
                || typeof estimate.currency !== 'string' || !/^[A-Z]{3}$/.test(estimate.currency) || currencies.has(estimate.currency)
                || typeof estimate.amount !== 'string' || !/^\d{1,18}(\.\d{1,12})?$/.test(estimate.amount)
                || !Number.isSafeInteger(estimate.estimated_calls) || Number(estimate.estimated_calls) < 0
                || Number(estimate.estimated_calls) > Number(usage.requests)) throw invalid()
            currencies.add(estimate.currency)
        }
    }
}
