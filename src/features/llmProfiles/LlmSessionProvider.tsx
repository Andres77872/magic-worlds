import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure'
import { authSession } from '@/infrastructure/api/authSession'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { configureLlmPreparation } from '@/infrastructure/api/llmPreparation'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'
import type { LlmFeature, LlmSelection } from '@/shared/types/llm.types'
import { Button, Field, Input, Modal } from '@/ui/primitives'
import { credentialSession } from './credentialSession'
import { LlmFeatureSelectionContext } from './LlmFeatureSelectionContext'

type PendingKey = { feature: LlmFeature; profile: EffectiveLlmProfile; owner: string; accept: () => void; reject: (error: Error) => void }
type SelectionState = { accountKey: string; selections: Partial<Record<LlmFeature, LlmSelection>> }

export function LlmSessionProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation()
    const { accountKey, sessionPhase } = useAuth()
    const [selectionState, setSelectionState] = useState<SelectionState>({ accountKey, selections: {} })
    const selectionsRef = useRef(selectionState)
    const [pending, setPending] = useState<PendingKey | null>(null)
    const [error, setError] = useState(false)
    const pendingRef = useRef<PendingKey | null>(null)
    const input = useRef<HTMLInputElement>(null)
    const cancel = useCallback(() => {
        if (input.current) input.current.value = ''
        pendingRef.current?.reject(new DOMException('Credential entry cancelled.', 'AbortError'))
        pendingRef.current = null
        setPending(null)
        setError(false)
    }, [])

    useEffect(() => {
        const unsubscribe = configureLlmPreparation(async (feature, signal, selection, retryOfExecutionId, recoveryRequestId) => {
            const owner = authSession.getSnapshot()
            const choices = selectionsRef.current
            // Capture intent before resolving. A queued dispatch never reads a later UI selection.
            const intent = { ...(selection ?? (choices.accountKey === owner.accountKey ? choices.selections[feature] : undefined) ?? { mode: 'inherit' as const }) }
            const profile = recoveryRequestId ? await apiService.getLlmRecoveryProfile(feature, recoveryRequestId, signal)
                : retryOfExecutionId ? await apiService.getLlmRetryProfile(feature, retryOfExecutionId)
                : await apiService.resolveLlmProfile(feature, intent)
            signal?.throwIfAborted()
            const current = authSession.getSnapshot()
            if (current.accountKey !== owner.accountKey || current.authEpoch !== owner.authEpoch || current.sessionPhase !== 'authenticated') {
                throw new Error('LLM_SESSION_CHANGED')
            }
            credentialSession.setProject(profile.project_hash, current.accountKey)
            const initialScope = credentialSession.ownerScope()
            credentialSession.select(feature, profile)
            if ((retryOfExecutionId || recoveryRequestId) && profile.credential_mode === 'user_byok') credentialSession.forget(profile)
            if (profile.credential_mode === 'user_byok' && !credentialSession.has(profile)) {
                if (!API_BASE_URL.startsWith('https://')) throw new Error('LLM_CREDENTIAL_HTTPS_REQUIRED')
                if (pendingRef.current) throw new Error('LLM_CREDENTIAL_ENTRY_BUSY')
                await new Promise<void>((accept, reject) => {
                    const request: PendingKey = { feature, profile, owner: credentialSession.ownerScope(), accept, reject }
                    pendingRef.current = request
                    setPending(request)
                    const aborted = () => { if (pendingRef.current === request) cancel() }
                    signal?.addEventListener('abort', aborted, { once: true })
                    request.accept = () => { signal?.removeEventListener('abort', aborted); accept() }
                    request.reject = error => { signal?.removeEventListener('abort', aborted); reject(error) }
                })
            }
            signal?.throwIfAborted()
            if (authSession.getSnapshot().accountKey !== owner.accountKey || authSession.getSnapshot().sessionPhase !== 'authenticated') {
                throw new Error('LLM_SESSION_CHANGED')
            }
            return () => {
                signal?.throwIfAborted()
                const latest = authSession.getSnapshot()
                if (latest.accountKey !== owner.accountKey || latest.sessionPhase !== 'authenticated') throw new Error('LLM_SESSION_CHANGED')
                if (profile.credential_mode === 'user_byok' && latest.token !== current.token) throw new Error('LLM_SESSION_CHANGED')
                if (profile.credential_mode === 'user_byok' && credentialSession.ownerScope() !== initialScope) throw new Error('LLM_SESSION_CHANGED')
                return credentialSession.materialize(profile)
            }
        })
        return () => { unsubscribe(); cancel(); credentialSession.clear() }
    }, [cancel])

    useEffect(() => {
        cancel(); credentialSession.clear()
        const next = { accountKey, selections: {} }
        selectionsRef.current = next
        setSelectionState(next)
    }, [accountKey, sessionPhase, cancel])

    const select = useCallback((feature: LlmFeature, selection: LlmSelection, profile: EffectiveLlmProfile) => {
        const owner = authSession.getSnapshot()
        if (owner.sessionPhase !== 'authenticated' || owner.accountKey !== accountKey) throw new Error('LLM_SESSION_CHANGED')
        if (selection.mode === 'profile' && selection.profile_id !== profile.profile_id) throw new Error('LLM_PROFILE_SELECTION_CHANGED')
        credentialSession.setProject(profile.project_hash, owner.accountKey)
        credentialSession.select(feature, profile)
        if (pendingRef.current?.feature === feature) cancel()
        const previous = selectionsRef.current
        const next = { accountKey, selections: { ...(previous.accountKey === accountKey ? previous.selections : {}), [feature]: { ...selection } } }
        selectionsRef.current = next
        setSelectionState(next)
    }, [accountKey, cancel])
    const context = useMemo(() => ({ accountKey, selections: selectionState.accountKey === accountKey ? selectionState.selections : {}, select }), [accountKey, selectionState, select])

    const confirm = () => {
        const request = pendingRef.current
        if (!request || !input.current) return
        try {
            credentialSession.remember(request.profile, input.current.value, request.owner)
            input.current.value = ''
            pendingRef.current = null
            setPending(null)
            setError(false)
            request.accept()
        } catch { setError(true) }
    }

    return <LlmFeatureSelectionContext.Provider value={context}>
        {children}
        <Modal open={pending !== null} onClose={cancel} title={t('llmProfiles.key.title')} size="sm"
            footer={<><Button variant="ghost" onClick={cancel}>{t('llmProfiles.cancel')}</Button><Button onClick={confirm}>{t('llmProfiles.key.use')}</Button></>}>
            <p className="mb-4 text-body text-parchment-200">{t('llmProfiles.key.explanation')}</p>
            <p className="mb-4 text-label text-parchment-300">{pending?.profile.provider_target_key} · {t('llmProfiles.byokCost')}</p>
            <Field label={t('llmProfiles.key.label')} error={error ? t('llmProfiles.key.invalid') : undefined}>
                <Input ref={input} type="password" autoComplete="off" maxLength={4096} data-private="true" />
            </Field>
        </Modal>
    </LlmFeatureSelectionContext.Provider>
}
