import type { TFunction } from 'i18next'

const CODES = new Set([
    'LLM_EXECUTION_IN_PROGRESS', 'LLM_EXECUTION_RECOVERY_REQUIRED', 'LLM_EXECUTION_FINISHED', 'LLM_EXECUTION_UPSTREAM_FAILED',
    'LLM_EXECUTION_INTENT_CHANGED', 'PROFILE_REVISION_CHANGED', 'BYOK_CREDENTIAL_REQUIRED', 'PLATFORM_CREDITS_EXHAUSTED',
])

/** Copy for request-recovery outcomes and refused admissions that tells the user what another try will do; null otherwise. */
export function llmRecoveryMessage(error: unknown, t: TFunction): string | null {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
    return typeof code === 'string' && CODES.has(code) ? t(`llmProfiles.recovery.${code}`) : null
}
