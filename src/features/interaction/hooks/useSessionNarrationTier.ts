/**
 * The per-session narration tier override (R1-FE-04, EP-1) of one adventure
 * session or character chat: `GET|PUT /{basePath}/{id}/voice-settings` on the
 * session's workspace client (`api`), so X-Workspace-Id rides along.
 *
 * - Every signed-in caller reads it (I-68: no cohort). The capabilities read
 *   comes first (the account tier for the Default label); on a failed
 *   capabilities or settings read (a 404 included) `settings` stays null and
 *   callers render nothing.
 * - `setTier(null)` clears the override (the session follows the account
 *   tier). Optimistic: the choice shows at once and rolls back on a refusal
 *   (409 or 422), with copy for the voice codes (R-10), the archived workspace,
 *   or a generic failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, type ApiService } from '@/infrastructure/api'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import type { NarrationTier, VoiceCapabilities } from '@/shared/types'
import type { SessionVoiceSettings, VoiceSessionBasePath } from '@/shared/types/sessionVoice.types'
import { voiceWriteErrorKey } from '@/shared/voice/voiceWriteErrors'

export type SessionNarrationTierApi = Partial<Pick<ApiService, 'getVoiceCapabilities' | 'getSessionVoiceSettings' | 'setSessionNarrationTier'>>

export interface SessionNarrationTierState {
    /** The server settings with any pending choice applied; null when the control is not offered. */
    settings: SessionVoiceSettings | null
    /** The caller's capabilities reading (the account tier for the Default label). */
    capabilities: VoiceCapabilities | null
    loading: boolean
    saving: boolean
    /** Localised refusal copy of the last failed save. */
    error: string | null
    setTier: (tier: NarrationTier | null) => Promise<void>
}

/** Copy for a refused voice write on a session document (R-10, R-11 and the workspace path). */
export function sessionVoiceErrorKey(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.code === 'WORKSPACE_ARCHIVED') return ARCHIVED_WORKSPACE_MESSAGE_KEY
        const key = error.code ? voiceWriteErrorKey(error.code) : null
        if (key) return key
    }
    return 'voices.errors.budgetUnavailable'
}

export function useSessionNarrationTier(
    api: SessionNarrationTierApi | null | undefined,
    basePath: VoiceSessionBasePath,
    sessionId: number | null | undefined,
): SessionNarrationTierState {
    const { t } = useTranslation()
    const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null)
    const [loaded, setLoaded] = useState<{ key: string; settings: SessionVoiceSettings | null } | null>(null)
    const [pending, setPending] = useState<{ tier: NarrationTier | null } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const savingRef = useRef(false)

    const validId = typeof sessionId === 'number' && Number.isInteger(sessionId) && sessionId > 0
    const canRead = Boolean(api && validId && typeof api.getVoiceCapabilities === 'function' && typeof api.getSessionVoiceSettings === 'function')
    const key = `${basePath}:${validId ? sessionId : ''}`

    useEffect(() => {
        if (!canRead || !api) return
        let cancelled = false
        void Promise.resolve()
            .then(() => api.getVoiceCapabilities!())
            .then(async (next) => {
                if (cancelled) return
                setCapabilities(next ?? null)
                const settings = await api.getSessionVoiceSettings!(basePath, sessionId as number)
                if (!cancelled) setLoaded({ key, settings: settings ?? null })
            })
            .catch(() => {
                if (!cancelled) setLoaded({ key, settings: null })
            })
        return () => {
            cancelled = true
        }
    }, [api, basePath, canRead, key, sessionId])

    const current = loaded && loaded.key === key ? loaded.settings : null

    const setTier = useCallback(async (tier: NarrationTier | null) => {
        if (!api || typeof api.setSessionNarrationTier !== 'function' || !current || savingRef.current) return
        savingRef.current = true
        setPending({ tier })
        setError(null)
        try {
            const next = await api.setSessionNarrationTier(basePath, current.session_id, tier)
            setLoaded({ key, settings: next ?? { ...current, tier_override: tier } })
        } catch (cause) {
            setError(t(sessionVoiceErrorKey(cause)))
        } finally {
            savingRef.current = false
            setPending(null)
        }
    }, [api, basePath, current, key, t])

    const settings = current && pending ? { ...current, tier_override: pending.tier } : current
    return {
        settings: capabilities ? settings : null,
        capabilities,
        loading: canRead && !(loaded && loaded.key === key),
        saving: pending !== null,
        error,
        setTier,
    }
}
