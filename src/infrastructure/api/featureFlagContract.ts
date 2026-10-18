import { ACTIVE_FEATURE_FLAGS, ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'
import type { FeatureFlagDefinition, FeatureFlagSnapshot } from '@/shared/featureFlagRuntime'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const revision = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value)
export class FeatureFlagContractError extends Error {
    readonly code = 'FEATURE_FLAG_CATALOG_MISMATCH'
}

export function parseFeatureFlagSnapshot(value: unknown): FeatureFlagSnapshot {
    const fail = (): never => { throw new FeatureFlagContractError('Feature permissions require a supported application version.') }
    if (!record(value) || value.schema_version !== 1 || !revision(value.catalog_revision)
        || typeof value.user_hash !== 'string' || !value.user_hash || !Array.isArray(value.flags) || value.flags.length > 128) return fail()
    const flags: FeatureFlagDefinition[] = []
    const seen = new Set<string>()
    for (const item of value.flags) {
        if (!record(item) || typeof item.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(item.key)
            || seen.has(item.key) || !Array.isArray(item.requires) || item.requires.some(key => typeof key !== 'string')) return fail()
        seen.add(item.key)
        flags.push({ key: item.key, requires: item.requires as string[] })
    }
    for (const key of ACTIVE_FEATURE_KEYS) {
        const definition = flags.find(flag => flag.key === key)
        if (!definition || definition.requires.length !== ACTIVE_FEATURE_FLAGS[key].requires.length
            || definition.requires.some(parent => !(ACTIVE_FEATURE_FLAGS[key].requires as readonly string[]).includes(parent))) return fail()
    }
    const raw = value.permissions
    if (raw != null && !record(raw)) return fail()
    const permissions: Record<string, boolean> = {}
    for (const key of seen) {
        const grant = record(raw) ? raw[key] : undefined
        if (grant != null && typeof grant !== 'boolean') return fail()
        permissions[key] = grant === true
    }
    const bypass = value.bypass === true
    if (!bypass && flags.length && (typeof value.plan_code !== 'string' || !revision(value.membership_revision) || !revision(value.plan_feature_revision))) return fail()
    if (typeof value.valid_for_seconds !== 'number' || !Number.isFinite(value.valid_for_seconds)
        || value.valid_for_seconds < 0 || value.valid_for_seconds > 900) return fail()
    return { schema_version: 1, catalog_revision: value.catalog_revision as string, user_hash: value.user_hash,
        plan_code: typeof value.plan_code === 'string' ? value.plan_code : null,
        membership_revision: typeof value.membership_revision === 'string' ? value.membership_revision : null,
        plan_feature_revision: typeof value.plan_feature_revision === 'string' ? value.plan_feature_revision : null,
        flags, permissions, valid_for_seconds: value.valid_for_seconds, bypass }
}

