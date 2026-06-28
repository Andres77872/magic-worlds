import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Mic } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceCloneRequest, AdminVoiceCloneResponse } from '@/shared'
import { Button, Field, Icon, Input, SwitchRow, Textarea } from '@/ui/primitives'
import {
    CLONE_MAX_BYTES,
    CLONE_MAX_SECONDS,
    CLONE_MIN_SECONDS,
    PREVIEW_TEXT_LIMIT,
    PROMPT_AUDIO_MAX_SECONDS,
    PROMPT_TEXT_LIMIT,
} from '../constants'
import { readAudioDuration } from '../hexAudio'
import type { StudioToast } from '../hooks/useVoiceStudio'
import { validateVoiceId } from '../voiceIdRules'
import { AudioDropzone, type AudioDropzoneSelection } from './AudioDropzone'
import { VoiceResultCard } from './VoiceResultCard'

interface VoiceCloneFormProps {
    onCreated: () => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
    onSendToLab: (voiceId: string) => void
}

const ACCEPTED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
]

function isAcceptedAudio(file: File): boolean {
    return ACCEPTED_AUDIO_TYPES.includes(file.type) || /\.(mp3|m4a|wav)$/i.test(file.name)
}

export function VoiceCloneForm({ onCreated, notify, setError, onSendToLab }: VoiceCloneFormProps) {
    const { t } = useTranslation()
    const [voiceId, setVoiceId] = useState('')
    const [touchedVoiceId, setTouchedVoiceId] = useState(false)

    const [fileId, setFileId] = useState<number | null>(null)
    const [mainSelection, setMainSelection] = useState<AudioDropzoneSelection | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | undefined>(undefined)

    const [promptFileId, setPromptFileId] = useState<number | null>(null)
    const [promptSelection, setPromptSelection] = useState<AudioDropzoneSelection | null>(null)
    const [promptUploading, setPromptUploading] = useState(false)
    const [promptUploadError, setPromptUploadError] = useState<string | undefined>(undefined)
    const [promptText, setPromptText] = useState('')

    const [previewText, setPreviewText] = useState('')
    const [noiseReduction, setNoiseReduction] = useState(true)
    const [volumeNormalization, setVolumeNormalization] = useState(true)

    const [cloning, setCloning] = useState(false)
    const [cloned, setCloned] = useState<AdminVoiceCloneResponse | null>(null)

    const voiceIdCheck = validateVoiceId(voiceId, t)
    const previewOverLimit = previewText.length > PREVIEW_TEXT_LIMIT
    const promptTextOverLimit = promptText.length > PROMPT_TEXT_LIMIT
    // clone_prompt requires BOTH the audio and its transcript, or neither.
    const promptPaired = (promptFileId == null) === (promptText.trim().length === 0)
    const canClone =
        fileId != null &&
        voiceIdCheck.ok &&
        promptPaired &&
        !previewOverLimit &&
        !promptTextOverLimit &&
        !uploading &&
        !promptUploading &&
        !cloning

    const handleMainSelect = async (file: File) => {
        setUploadError(undefined)
        setFileId(null)
        if (!isAcceptedAudio(file)) {
            setUploadError(t('admin.voices.clone.errors.unsupportedAudio'))
            return
        }
        if (file.size > CLONE_MAX_BYTES) {
            setUploadError(t('admin.voices.clone.errors.tooLarge'))
            return
        }
        let durationSec: number | null = null
        try {
            durationSec = await readAudioDuration(file)
        } catch {
            // Metadata unreadable; the server re-validates duration.
        }
        if (durationSec != null && (durationSec < CLONE_MIN_SECONDS || durationSec > CLONE_MAX_SECONDS)) {
            setUploadError(t('admin.voices.clone.errors.duration'))
            return
        }
        setMainSelection({ name: file.name, sizeBytes: file.size, durationSec })
        setUploading(true)
        try {
            const response = await apiService.uploadAdminVoiceCloneSample(file, 'voice_clone')
            setFileId(response.file_id)
        } catch (err) {
            setMainSelection(null)
            setUploadError(err instanceof Error ? err.message : t('admin.voices.clone.errors.uploadFailed'))
        } finally {
            setUploading(false)
        }
    }

    const clearMain = () => {
        setFileId(null)
        setMainSelection(null)
        setUploadError(undefined)
    }

    const handlePromptSelect = async (file: File) => {
        setPromptUploadError(undefined)
        setPromptFileId(null)
        if (!isAcceptedAudio(file)) {
            setPromptUploadError(t('admin.voices.clone.errors.unsupportedAudio'))
            return
        }
        let durationSec: number | null = null
        try {
            durationSec = await readAudioDuration(file)
        } catch {
            // Metadata unreadable; the server re-validates duration.
        }
        if (durationSec != null && durationSec > PROMPT_AUDIO_MAX_SECONDS) {
            setPromptUploadError(t('admin.voices.clone.errors.promptDuration'))
            return
        }
        setPromptSelection({ name: file.name, sizeBytes: file.size, durationSec })
        setPromptUploading(true)
        try {
            const response = await apiService.uploadAdminVoiceCloneSample(file, 'prompt_audio')
            setPromptFileId(response.file_id)
        } catch (err) {
            setPromptSelection(null)
            setPromptUploadError(err instanceof Error ? err.message : t('admin.voices.clone.errors.uploadFailed'))
        } finally {
            setPromptUploading(false)
        }
    }

    const clearPrompt = () => {
        setPromptFileId(null)
        setPromptSelection(null)
        setPromptUploadError(undefined)
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canClone || fileId == null) return
        setCloning(true)
        setError(null)
        try {
            const body: AdminVoiceCloneRequest = {
                file_id: fileId,
                voice_id: voiceId.trim(),
                need_noise_reduction: noiseReduction,
                need_volume_normalization: volumeNormalization,
            }
            if (promptFileId != null && promptText.trim()) {
                body.clone_prompt = { prompt_audio: promptFileId, prompt_text: promptText.trim() }
            }
            if (previewText.trim()) {
                body.text = previewText.trim()
                body.model = 'speech-2.8-hd'
            }
            const response = await apiService.cloneAdminVoice(body)
            setCloned(response)
            notify({ tone: 'success', title: t('admin.voices.clone.toasts.success'), message: response.voice_id })
            onCreated()
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.voices.clone.errors.fail')
            setError(message)
            notify({ tone: 'error', title: t('admin.voices.clone.toasts.failed'), message })
        } finally {
            setCloning(false)
        }
    }

    return (
        <form className="flex flex-col gap-5" onSubmit={(event) => void handleSubmit(event)}>
            <AudioDropzone
                label={t('admin.voices.clone.mainDropLabel')}
                hint={t('admin.voices.clone.mainDropHint')}
                selection={mainSelection}
                busy={uploading}
                error={uploadError}
                onSelect={(file) => void handleMainSelect(file)}
                onClear={clearMain}
            />

            <Field
                label={t('admin.voices.clone.voiceIdLabel')}
                error={touchedVoiceId && !voiceIdCheck.ok ? voiceIdCheck.reason : undefined}
                helper={t('admin.voices.clone.voiceIdHelper')}
            >
                <Input
                    value={voiceId}
                    onChange={(event) => setVoiceId(event.target.value)}
                    onBlur={() => setTouchedVoiceId(true)}
                    placeholder="MyClonedVoice01"
                />
            </Field>

            <SwitchRow
                label={t('admin.voices.clone.noiseReductionLabel')}
                description={t('admin.voices.clone.noiseReductionDescription')}
                checked={noiseReduction}
                onChange={setNoiseReduction}
            />
            <SwitchRow
                label={t('admin.voices.clone.volumeNormalizationLabel')}
                description={t('admin.voices.clone.volumeNormalizationDescription')}
                checked={volumeNormalization}
                onChange={setVolumeNormalization}
            />

            <Field
                label={t('admin.voices.clone.previewLabel')}
                error={previewOverLimit ? t('admin.voices.design.previewError', { limit: PREVIEW_TEXT_LIMIT }) : undefined}
                helper={t('admin.voices.clone.previewHelper')}
            >
                <Textarea
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder={t('admin.voices.clone.previewPlaceholder')}
                />
            </Field>

            <details className="rounded-lg border border-parchment-50/[.08] bg-ink-800/40 px-4 py-3">
                <summary className="cursor-pointer font-ui text-sm font-semibold text-parchment-100">
                    {t('admin.voices.clone.promptSummary')}
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                    <AudioDropzone
                        compact
                        label={t('admin.voices.clone.promptDropLabel')}
                        hint={t('admin.voices.clone.promptDropHint')}
                        selection={promptSelection}
                        busy={promptUploading}
                        error={promptUploadError}
                        onSelect={(file) => void handlePromptSelect(file)}
                        onClear={clearPrompt}
                    />
                    <Field
                        label={t('admin.voices.clone.transcriptLabel')}
                        error={promptTextOverLimit ? t('admin.voices.clone.transcriptError', { limit: PROMPT_TEXT_LIMIT }) : undefined}
                        helper={t('admin.voices.clone.transcriptHelper')}
                    >
                        <Textarea
                            value={promptText}
                            onChange={(event) => setPromptText(event.target.value)}
                            placeholder={t('admin.voices.clone.transcriptPlaceholder')}
                        />
                    </Field>
                </div>
            </details>

            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="primary"
                    iconLeft={<Icon icon={cloning ? Loader2 : Mic} size={15} className={cloning ? 'animate-spin' : undefined} />}
                    disabled={!canClone}
                >
                    {t('admin.voices.clone.submit')}
                </Button>
            </div>

            {cloned && (
                <VoiceResultCard
                    tone="ember"
                    badgeLabel={t('admin.voices.clone.resultBadge')}
                    voiceId={cloned.voice_id}
                    audioSrc={cloned.demo_audio_url ?? null}
                    audioTitle={t('admin.voices.clone.resultAudioTitle')}
                    caveat={t('admin.voices.clone.resultCaveat')}
                    onSendToLab={onSendToLab}
                />
            )}
        </form>
    )
}
