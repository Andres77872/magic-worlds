/**
 * The caller's undismissed D15 review flags (R1-FE-03): loaded once while
 * `enabled` (default true; a signed-in surface). A failed read (404 included)
 * reads as no flags.
 *
 * `dismiss` removes the flag at once and restores it when the server refuses;
 * `dismissError` then carries the copy key for a toast or inline line.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import type { VoiceReviewFlag, VoiceReviewFlagRefType } from '@/shared'

/** A flag's `json_path` matches the requested path, or any voice path when none is given. */
function pathMatches(flag: VoiceReviewFlag, jsonPath?: string | null): boolean {
    if (!jsonPath) return true
    if (flag.json_path === jsonPath) return true
    // BFF paths carry no `$.` prefix. A template cast flag points at one cast entry
    // (`characters[<card id>].voice`); asking for `characters` answers the cast as a whole.
    return flag.ref_type === 'template_cast' && jsonPath === 'characters' && flag.json_path.startsWith('characters[')
}

export interface VoiceReviewFlagsState {
    flags: VoiceReviewFlag[]
    loading: boolean
    flagFor: (refType: VoiceReviewFlagRefType, refId: string | null | undefined, jsonPath?: string | null) => VoiceReviewFlag | null
    flagsFor: (refType: VoiceReviewFlagRefType) => VoiceReviewFlag[]
    dismiss: (flagId: number) => Promise<void>
    /** i18n key of the last failed dismiss, cleared by the next dismiss. */
    dismissError: string | null
}

export function useVoiceReviewFlags(enabled = true): VoiceReviewFlagsState {
    const active = enabled && typeof apiService.listVoiceReviewFlags === 'function'
    const [flags, setFlags] = useState<VoiceReviewFlag[]>([])
    const [loading, setLoading] = useState(false)
    const [dismissError, setDismissError] = useState<string | null>(null)
    const loaded = useRef(false)

    useEffect(() => {
        if (!active || loaded.current) return
        loaded.current = true
        let cancelled = false
        setLoading(true)
        void Promise.resolve()
            .then(() => apiService.listVoiceReviewFlags())
            .then((list) => {
                if (!cancelled) setFlags(Array.isArray(list?.items) ? list.items : [])
            })
            .catch(() => {
                if (!cancelled) setFlags([])
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
            loaded.current = false
        }
    }, [active])

    const flagFor = useCallback<VoiceReviewFlagsState['flagFor']>((refType, refId, jsonPath) => {
        if (!refId) return null
        return flags.find((flag) => flag.ref_type === refType && flag.ref_id === refId && pathMatches(flag, jsonPath)) ?? null
    }, [flags])

    const flagsFor = useCallback((refType: VoiceReviewFlagRefType) => flags.filter((flag) => flag.ref_type === refType), [flags])

    const dismiss = useCallback(async (flagId: number) => {
        const removed = flags.find((flag) => flag.flag_id === flagId)
        if (!removed) return
        setDismissError(null)
        setFlags((current) => current.filter((flag) => flag.flag_id !== flagId))
        try {
            await apiService.dismissVoiceReviewFlag(flagId)
        } catch {
            setFlags((current) => (current.some((flag) => flag.flag_id === flagId) ? current : [...current, removed]))
            setDismissError('voices.notice.reviewFlagDismissFailed')
        }
    }, [flags])

    return { flags: active ? flags : [], loading: active && loading, flagFor, flagsFor, dismiss, dismissError }
}
