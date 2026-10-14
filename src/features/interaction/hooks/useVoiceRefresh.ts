/**
 * The "use the card's current voice" refresh (R1-FE-04, EP-2) as one small
 * state machine: idle → busy → done | error. The caller passes the request
 * (`refreshChatVoice` / `refreshAdventureVoices` on the session client, through
 * DataProvider so the returned DTO replaces the stored session).
 *
 * Refusals (R-11, I-36) map to copy:
 * - 409 `voice_refresh_busy` (a reply or call is in flight) → busyConflict;
 * - 409 `WORKSPACE_ARCHIVED` → the shared archived-workspace copy;
 * - `voice_source_unavailable` (D39: the source card was deleted, copied elsewhere
 *   or is in another workspace) → sourceUnavailable, "The original card isn't in
 *   this workspace anymore." (05 §7.8, 09 §2.2); with `reason: no_voice` (the card
 *   has no voice) → sourceNoVoice;
 * - any other 422 (the voice is not eligible) → notEligible;
 * - anything else → the generic voice-unavailable line.
 */
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'

export type VoiceRefreshStatus = 'idle' | 'busy' | 'done' | 'error'

export interface VoiceRefreshState {
    status: VoiceRefreshStatus
    /** Localised copy for the current status: busy, done or the refusal; null when idle. */
    message: string | null
    /** Runs one refresh; a second call while busy is ignored. Resolves true on success. */
    run: (request: () => Promise<unknown>) => Promise<boolean>
    reset: () => void
}

export function voiceRefreshErrorKey(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.code === 'voice_refresh_busy') return 'voices.refresh.busyConflict'
        if (error.code === 'WORKSPACE_ARCHIVED') return ARCHIVED_WORKSPACE_MESSAGE_KEY
        if (error.code === 'voice_source_unavailable') {
            return error.details?.reason === 'no_voice' ? 'voices.refresh.sourceNoVoice' : 'voices.refresh.sourceUnavailable'
        }
        if (error.status === 422) return 'voices.refresh.notEligible'
    }
    return 'voices.errors.budgetUnavailable'
}

export function useVoiceRefresh(): VoiceRefreshState {
    const { t } = useTranslation()
    const [state, setState] = useState<{ status: VoiceRefreshStatus; errorKey: string | null }>({ status: 'idle', errorKey: null })
    const busyRef = useRef(false)

    const run = useCallback(async (request: () => Promise<unknown>) => {
        if (busyRef.current) return false
        busyRef.current = true
        setState({ status: 'busy', errorKey: null })
        try {
            await request()
            setState({ status: 'done', errorKey: null })
            return true
        } catch (error) {
            setState({ status: 'error', errorKey: voiceRefreshErrorKey(error) })
            return false
        } finally {
            busyRef.current = false
        }
    }, [])

    const reset = useCallback(() => {
        if (!busyRef.current) setState({ status: 'idle', errorKey: null })
    }, [])

    const message = state.status === 'busy'
        ? t('voices.refresh.busy')
        : state.status === 'done'
            ? t('voices.refresh.done')
            : state.errorKey
                ? t(state.errorKey)
                : null
    return { status: state.status, message, run, reset }
}
