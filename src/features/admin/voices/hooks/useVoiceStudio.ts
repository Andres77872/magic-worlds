/**
 * Orchestration hook for the voice studio: owns the shared inventory (load /
 * filter / delete), the cross-panel error + toast surfaces, and the "send to
 * lab" wire that routes a voice id from the library or a fresh result into the
 * synthesis lab. Each panel keeps its own form state; this is the glue.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceEntry, AdminVoiceGroups, AdminVoiceQueryType } from '@/shared'

export interface StudioToast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

const emptyGroups = (): AdminVoiceGroups => ({
    system: [],
    voice_cloning: [],
    voice_generation: [],
})

export function useVoiceStudio(isRoot: boolean) {
    const { t } = useTranslation()
    const [groups, setGroups] = useState<AdminVoiceGroups>(emptyGroups)
    const [voiceType, setVoiceType] = useState<AdminVoiceQueryType>('all')
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<AdminVoiceEntry | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<StudioToast | null>(null)
    const [labVoiceId, setLabVoiceId] = useState('')

    const refreshVoices = useCallback(
        async (nextType: AdminVoiceQueryType = voiceType) => {
            if (!isRoot) return
            setLoadingVoices(true)
            setError(null)
            try {
                const response = await apiService.listAdminVoices(nextType)
                setGroups(response.groups)
            } catch (err) {
                setError(err instanceof Error ? err.message : t('admin.voices.errors.load'))
            } finally {
                setLoadingVoices(false)
            }
        },
        [isRoot, voiceType, t],
    )

    useEffect(() => {
        if (!isRoot) return
        // Loading the inventory on mount / filter change is a legitimate sync with
        // the backend (an external system), not a render-derivable value.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refreshVoices(voiceType)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRoot, voiceType])

    const confirmDelete = useCallback(async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target || target.voice_type === 'system') return
        setDeletingVoiceId(target.voice_id)
        setError(null)
        try {
            await apiService.deleteAdminVoice(target.voice_type, target.voice_id)
            setGroups((current) => ({
                ...current,
                [target.voice_type]: current[target.voice_type].filter((voice) => voice.voice_id !== target.voice_id),
            }))
            setToast({ tone: 'success', title: t('admin.voices.toasts.deleted'), message: target.voice_id })
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.voices.errors.delete')
            setError(message)
            setToast({ tone: 'error', title: t('admin.voices.toasts.deleteFailed'), message })
        } finally {
            setDeletingVoiceId(null)
        }
    }, [pendingDelete, t])

    const sendToLab = useCallback((voiceId: string) => {
        setLabVoiceId(voiceId)
        // Bring the lab into view on smaller screens where it sits below the library.
        const lab = typeof document !== 'undefined' ? document.getElementById('voice-synthesis-lab') : null
        if (lab && typeof lab.scrollIntoView === 'function') {
            lab.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [])

    return {
        groups,
        voiceType,
        setVoiceType,
        loadingVoices,
        deletingVoiceId,
        pendingDelete,
        setPendingDelete,
        confirmDelete,
        error,
        setError,
        toast,
        setToast,
        refreshVoices,
        labVoiceId,
        setLabVoiceId,
        sendToLab,
    }
}
