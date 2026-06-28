import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, WandSparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceDesignResponse } from '@/shared'
import { Button, Field, Icon, Input, Textarea } from '@/ui/primitives'
import { DEFAULT_PREVIEW_TEXT, DEFAULT_PROMPT, PREVIEW_TEXT_LIMIT } from '../constants'
import { useEphemeralAudioUrl } from '../hexAudio'
import type { StudioToast } from '../hooks/useVoiceStudio'
import { VoiceResultCard } from './VoiceResultCard'

interface VoiceDesignFormProps {
    onCreated: () => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
    onSendToLab: (voiceId: string) => void
}

export function VoiceDesignForm({ onCreated, notify, setError, onSendToLab }: VoiceDesignFormProps) {
    const { t } = useTranslation()
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
    const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT)
    const [customVoiceId, setCustomVoiceId] = useState('')
    const [designing, setDesigning] = useState(false)
    const [designed, setDesigned] = useState<AdminVoiceDesignResponse | null>(null)

    const previewOverLimit = previewText.length > PREVIEW_TEXT_LIMIT
    const canDesign = prompt.trim().length > 0 && previewText.trim().length > 0 && !previewOverLimit && !designing
    const audioSrc = useEphemeralAudioUrl(designed?.trial_audio)

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canDesign) return
        setDesigning(true)
        setError(null)
        try {
            const response = await apiService.designAdminVoice({
                prompt: prompt.trim(),
                preview_text: previewText.trim(),
                ...(customVoiceId.trim() ? { voice_id: customVoiceId.trim() } : {}),
            })
            setDesigned(response)
            notify({ tone: 'success', title: t('admin.voices.design.toasts.success'), message: response.voice_id })
            onCreated()
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.voices.design.errors.fail')
            setError(message)
            notify({ tone: 'error', title: t('admin.voices.design.toasts.failed'), message })
        } finally {
            setDesigning(false)
        }
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(event) => void handleSubmit(event)}>
            <Field
                label={t('admin.voices.design.descriptionLabel')}
                helper={t('admin.voices.design.descriptionHelper')}
            >
                <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={t('admin.voices.design.descriptionPlaceholder')}
                />
            </Field>
            <Field
                label={t('admin.voices.design.previewLabel')}
                error={previewOverLimit ? t('admin.voices.design.previewError', { limit: PREVIEW_TEXT_LIMIT }) : undefined}
                helper={t('admin.voices.design.previewHelper', { count: previewText.length, limit: PREVIEW_TEXT_LIMIT })}
            >
                <Textarea
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder={t('admin.voices.design.previewPlaceholder')}
                />
            </Field>
            <Field label={t('admin.voices.design.customIdLabel')} helper={t('admin.voices.design.customIdHelper')}>
                <Input
                    value={customVoiceId}
                    onChange={(event) => setCustomVoiceId(event.target.value)}
                    placeholder="ttv-voice-custom-id"
                />
            </Field>
            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="primary"
                    iconLeft={<Icon icon={designing ? Loader2 : WandSparkles} size={15} className={designing ? 'animate-spin' : undefined} />}
                    disabled={!canDesign}
                >
                    {t('admin.voices.design.submit')}
                </Button>
            </div>

            {designed && (
                <VoiceResultCard
                    tone="arcane"
                    badgeLabel={t('admin.voices.design.resultBadge')}
                    voiceId={designed.voice_id}
                    audioSrc={audioSrc}
                    audioTitle={t('admin.voices.design.resultAudioTitle')}
                    audioMissingHint={t('admin.voices.design.resultMissing')}
                    onSendToLab={onSendToLab}
                />
            )}
        </form>
    )
}
