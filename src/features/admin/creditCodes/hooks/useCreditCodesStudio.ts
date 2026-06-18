/**
 * Orchestration hook for the credit-codes console: owns the two inventories
 * (redeem tokens + email invites), their load / refresh state, the shared error
 * and toast surfaces, and the disable flow (confirm dialog target + commit).
 * Each form keeps its own field state; this is the glue. Modeled on
 * `useVoiceStudio`.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { FreeCreditInvite, FreeCreditToken } from '@/shared'

export interface StudioToast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

/** Identifies which row a pending disable confirmation refers to. */
export interface PendingDisable {
    kind: 'token' | 'invite'
    id: number
    label: string
}

export function useCreditCodesStudio(isRoot: boolean) {
    const { t } = useTranslation()
    const [tokens, setTokens] = useState<FreeCreditToken[]>([])
    const [invites, setInvites] = useState<FreeCreditInvite[]>([])
    const [loadingTokens, setLoadingTokens] = useState(false)
    const [loadingInvites, setLoadingInvites] = useState(false)
    const [pendingDisable, setPendingDisable] = useState<PendingDisable | null>(null)
    const [disablingId, setDisablingId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<StudioToast | null>(null)

    const refreshTokens = useCallback(async () => {
        if (!isRoot) return
        setLoadingTokens(true)
        setError(null)
        try {
            const response = await apiService.listFreeCreditTokens()
            setTokens(response.items)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.creditCodes.errors.loadTokens'))
        } finally {
            setLoadingTokens(false)
        }
    }, [isRoot, t])

    const refreshInvites = useCallback(async () => {
        if (!isRoot) return
        setLoadingInvites(true)
        setError(null)
        try {
            const response = await apiService.listFreeCreditInvites()
            setInvites(response.items)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.creditCodes.errors.loadInvites'))
        } finally {
            setLoadingInvites(false)
        }
    }, [isRoot, t])

    useEffect(() => {
        if (!isRoot) return
        // Loading the inventories on mount is a legitimate backend sync, not a
        // render-derivable value.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refreshTokens()
        void refreshInvites()
    }, [isRoot, refreshTokens, refreshInvites])

    /** Prepend a freshly created token so the new code shows at the top of the list. */
    const addToken = useCallback((token: FreeCreditToken) => {
        setTokens((current) => [token, ...current])
    }, [])

    /** Merge freshly created invites in: replace any matching invite_id, prepend the rest. */
    const addInvites = useCallback((created: FreeCreditInvite[]) => {
        setInvites((current) => {
            const byId = new Map(created.map((invite) => [invite.invite_id, invite]))
            const merged = current.map((invite) => byId.get(invite.invite_id) ?? invite)
            const seen = new Set(current.map((invite) => invite.invite_id))
            const fresh = created.filter((invite) => !seen.has(invite.invite_id))
            return [...fresh, ...merged]
        })
    }, [])

    const confirmDisable = useCallback(async () => {
        const target = pendingDisable
        setPendingDisable(null)
        if (!target) return
        setDisablingId(target.id)
        setError(null)
        try {
            if (target.kind === 'token') {
                const updated = await apiService.disableFreeCreditToken(target.id)
                setTokens((current) => current.map((row) => (row.token_id === target.id ? updated : row)))
            } else {
                const updated = await apiService.disableFreeCreditInvite(target.id)
                setInvites((current) => current.map((row) => (row.invite_id === target.id ? updated : row)))
            }
            setToast({ tone: 'success', title: t('admin.creditCodes.toasts.disabled'), message: target.label })
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.creditCodes.errors.disable')
            setError(message)
            setToast({ tone: 'error', title: t('admin.creditCodes.toasts.disableFailed'), message })
        } finally {
            setDisablingId(null)
        }
    }, [pendingDisable, t])

    return {
        tokens,
        invites,
        loadingTokens,
        loadingInvites,
        pendingDisable,
        setPendingDisable,
        disablingId,
        confirmDisable,
        error,
        setError,
        toast,
        setToast,
        refreshTokens,
        refreshInvites,
        addToken,
        addInvites,
    }
}
