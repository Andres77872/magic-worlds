import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogVoice, VoiceDesignPreview, VoiceDesignResponse } from '@/shared'
import { isAbortError } from '../../consoleErrors'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import type { SaveDesignValues } from './SaveDesignForm'

interface PreviewSession {
    previews: VoiceDesignPreview[]
    description: string
    parentVoiceKey: string | null
}

/**
 * One design or remix session (05 §8.8): previews live in memory only and can
 * be saved in this session; the unchosen ids are sent as
 * `played_not_selected_voice_ids`. Generating again replaces the session.
 */
export function usePreviewSession() {
    const { t } = useTranslation()
    const { catalog, notify, reportError } = useVoiceConsole()
    const [session, setSession] = useState<PreviewSession | null>(null)
    const [chosenId, setChosenId] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [generateError, setGenerateError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saved, setSaved] = useState<AdminCatalogVoice | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => () => abortRef.current?.abort(), [])

    const generate = async (run: (signal: AbortSignal) => Promise<VoiceDesignResponse>, description: string, parentVoiceKey: string | null) => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setGenerating(true)
        setGenerateError(null)
        setSaveError(null)
        setSaved(null)
        try {
            const response = await run(controller.signal)
            if (controller.signal.aborted) return
            setSession({ previews: response.previews, description, parentVoiceKey })
            setChosenId(null)
        } catch (error) {
            if (controller.signal.aborted || isAbortError(error)) return
            setGenerateError(reportError(error))
        } finally {
            if (!controller.signal.aborted) setGenerating(false)
        }
    }

    const save = async (values: SaveDesignValues) => {
        if (!session || !chosenId) return
        setSaving(true)
        setSaveError(null)
        try {
            const voice = await apiService.saveAdminDesign({
                generated_voice_id: chosenId,
                voice_name: values.voiceName,
                voice_description: session.description,
                labels: values.labels,
                played_not_selected_voice_ids: session.previews.map((preview) => preview.generated_voice_id).filter((id) => id !== chosenId),
                ...(session.parentVoiceKey ? { parent_voice_key: session.parentVoiceKey } : {}),
            })
            catalog.upsert(voice)
            setSaved(voice)
            setSession(null)
            setChosenId(null)
            notify(t('admin.voices.toasts.designSaved'))
        } catch (error) {
            setSaveError(reportError(error))
        } finally {
            setSaving(false)
        }
    }

    const chosen = session?.previews.find((preview) => preview.generated_voice_id === chosenId) ?? null

    return { session, chosen, chosenId, setChosenId, generating, saving, generateError, saveError, saved, generate, save }
}
