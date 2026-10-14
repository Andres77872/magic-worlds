/**
 * Console error mapping (05 §8.14, 03 §5.8). Provider key-level failures
 * (bad key, missing scope, quota) are configuration problems: they raise the
 * console banner and are never shown as a voice problem.
 */
import type { TFunction } from 'i18next'
import { ApiError } from '@/infrastructure/api'
import { PUBLISH_PRECONDITION_CODE, publishFailureMessage, publishFailures } from './publishFailures'

const CONFIGURATION_CODES = new Set([
    'invalid_api_key',
    'insufficient_permissions',
    'missing_permissions',
    'model_access_denied',
    'ip_denied',
    'quota_exceeded',
    'payment_required',
    'insufficient_credits',
    'provider_configuration',
])

const CONFIGURATION_CATEGORIES = new Set(['configuration', 'provider_configuration', 'provider_auth'])

const MODERATION_CODES = new Set(['content_blocked', 'moderation_blocked'])

/** Console codes of the R0 BFF with their own copy (renamed from provider-like names, console-api). */
const CODE_KEYS: Readonly<Record<string, string>> = {
    // I-15 / D16: the BFF refuses a pass that needs more than −6 dB of attenuation.
    gain_out_of_range: 'admin.voices.errors.gainOutOfRange',
    catalog_voice_not_found: 'admin.voices.errors.catalogVoiceNotFound',
    model_not_allowed: 'admin.voices.errors.modelNotAllowed',
    acceptance_scripts_missing: 'admin.voices.errors.acceptanceScriptsMissing',
    unsupported_output_format: 'admin.voices.errors.unsupportedOutputFormat',
    unsupported_text_normalization: 'admin.voices.errors.unsupportedNormalization',
    // Lab and acceptance renders (R0 console-api): never the server's English text.
    text_empty: 'admin.voices.errors.textEmpty',
    script_version_mismatch: 'admin.voices.errors.scriptVersionMismatch',
    repoint_target_invalid: 'admin.voices.errors.repointTargetInvalid',
    voice_unavailable: 'admin.voices.errors.voiceUnavailable',
    synthesis_unavailable: 'admin.voices.errors.synthesisUnavailable',
    spend_circuit_open: 'admin.voices.errors.spendCircuitOpen',
    provider_unavailable: 'admin.voices.errors.providerUnavailable',
    provider_busy: 'admin.voices.errors.providerBusy',
    provider_rejected: 'admin.voices.errors.providerRejected',
    provider_error: 'admin.voices.errors.providerError',
    // Library search (R0 console-caps): coded 422s for the sort and locale filters.
    library_sort_unsupported: 'admin.voices.errors.librarySortUnsupported',
    library_locale_invalid: 'admin.voices.errors.libraryLocaleInvalid',
    // Sync (R0-BE-35): the mass-removal override without a mass-removal abort, and no runner.
    no_mass_removal_abort: 'admin.voices.errors.noMassRemovalAbort',
    sync_unavailable: 'admin.voices.errors.syncUnavailable',
    // Global presets (EP-5, R1-FE-06).
    voice_not_eligible: 'admin.voices.globalPresets.errors.voiceNotEligible',
    global_preset_seed_exists: 'admin.voices.globalPresets.errors.seedExists',
    global_preset_legacy: 'admin.voices.globalPresets.errors.legacyReadOnly',
}

/** `text_rejected` carries the speech pipeline's fixed `reason` (never content). */
const TEXT_REJECTED_KEYS: Readonly<Record<string, string>> = {
    markup: 'admin.voices.errors.textRejectedMarkup',
    markup_overflow: 'admin.voices.errors.textRejectedOverflow',
    tag_contract: 'admin.voices.errors.textRejectedTagContract',
}

export interface ConsoleErrorInfo {
    message: string
    /** Raise the configuration banner instead of a per-action error. */
    configuration: boolean
    requestId: string | null
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException ? error.name === 'AbortError' : (error as { name?: string } | null)?.name === 'AbortError'
}

export function isConfigurationError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false
    if (error.code && CONFIGURATION_CODES.has(error.code)) return true
    return Boolean(error.category && CONFIGURATION_CATEGORIES.has(error.category))
}

/**
 * `languageName` turns the `:<lang>` suffix of a publish refusal into a name
 * ("English"); without it the code is shown.
 */
export function describeConsoleError(error: unknown, t: TFunction, languageName?: (code: string) => string): ConsoleErrorInfo {
    if (!(error instanceof ApiError)) {
        return { message: t('admin.voices.errors.generic'), configuration: false, requestId: null }
    }
    const requestId = error.requestId ?? null
    if (isConfigurationError(error)) return { message: t('admin.voices.configBanner.body'), configuration: true, requestId }
    if (error.code === 'moderation_unavailable') return { message: t('admin.voices.errors.moderationUnavailable'), configuration: false, requestId }
    if (error.code === 'text_rejected') {
        const reason = error.details?.reason
        const key = typeof reason === 'string' ? TEXT_REJECTED_KEYS[reason] : undefined
        return { message: t(key ?? 'admin.voices.errors.textRejected'), configuration: false, requestId }
    }
    const codeKey = error.code ? CODE_KEYS[error.code] : undefined
    if (codeKey) return { message: t(codeKey), configuration: false, requestId }
    if (error.code === 'text_over_model_limit') {
        const max = error.details?.max_chars
        const message = typeof max === 'number' && Number.isFinite(max)
            ? t('admin.voices.errors.textOverModelLimit', { max })
            : t('admin.voices.errors.textOverModelLimitUnknown')
        return { message, configuration: false, requestId }
    }
    const failures = publishFailures(error)
    if (failures) {
        const reasons = failures.map((failure) => publishFailureMessage(failure, t, languageName))
        const message = error.code === PUBLISH_PRECONDITION_CODE
            ? reasons.length > 0
                ? t('admin.voices.errors.publishPrecondition', { reasons: reasons.join(' ') })
                : t('admin.voices.errors.publishPreconditionGeneric')
            : reasons[0]
        return { message, configuration: false, requestId }
    }
    if (error.code && MODERATION_CODES.has(error.code)) return { message: t('admin.voices.errors.moderation'), configuration: false, requestId }
    if (error.status === 403) return { message: t('admin.voices.errors.rootRequired'), configuration: false, requestId }
    if (error.status === 404) return { message: t('admin.voices.errors.notFound'), configuration: false, requestId }
    if (error.status === 409) return { message: error.message || t('admin.voices.errors.conflict'), configuration: false, requestId }
    if (error.status === 429) return { message: t('admin.voices.errors.rateLimited'), configuration: false, requestId }
    // Validation and precondition failures carry the server's specific reason (e.g. a failed checklist item).
    if (error.status === 400 || error.status === 422 || error.status === 428) {
        return { message: error.message || t('admin.voices.errors.generic'), configuration: false, requestId }
    }
    return { message: t('admin.voices.errors.generic'), configuration: false, requestId }
}
