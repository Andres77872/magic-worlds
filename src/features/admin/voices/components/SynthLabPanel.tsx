import { useRef, useState, type FormEvent, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Loader2, Play } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceAudioFormat, AdminVoiceEmotion, AdminVoiceModel, AdminVoiceSampleRate, AdminVoiceTestRequest, AdminVoiceTestResponse } from '@/shared'
import { Badge, Button, Card, Field, Icon, Input, SectionHeader, Textarea } from '@/ui/primitives'
import { DEFAULT_SYNTH_SETTINGS, DEFAULT_TEST_TEXT, TEST_TEXT_LIMIT, type SynthSettings } from '../constants'
import { useEphemeralAudioUrl } from '../hexAudio'
import type { StudioToast } from '../hooks/useVoiceStudio'
import { SynthControls } from './SynthControls'
import { TextArtifactToolbar } from './TextArtifactToolbar'
import { VoiceResultCard } from './VoiceResultCard'

interface SynthLabPanelProps {
    voiceId: string
    onVoiceIdChange: (voiceId: string) => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
}

function buildMetaLine(result: AdminVoiceTestResponse, t: TFunction): string {
    const parts: string[] = []
    if (result.duration_ms) parts.push(`${(result.duration_ms / 1000).toFixed(1)}s`)
    if (result.sample_rate) parts.push(`${Math.round(result.sample_rate / 1000)} kHz`)
    if (result.bitrate) parts.push(`${Math.round(result.bitrate / 1000)} kbps`)
    if (result.usage_characters != null) parts.push(t('admin.voices.synth.chars', { count: result.usage_characters }))
    return parts.join(' · ')
}

export function SynthLabPanel({ voiceId, onVoiceIdChange, notify, setError }: SynthLabPanelProps) {
    const { t } = useTranslation()
    const [text, setText] = useState(DEFAULT_TEST_TEXT)
    const [settings, setSettings] = useState<SynthSettings>(DEFAULT_SYNTH_SETTINGS)
    const [testing, setTesting] = useState(false)
    const [tested, setTested] = useState<AdminVoiceTestResponse | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    const testOverLimit = text.length > TEST_TEXT_LIMIT
    const canTest = voiceId.trim().length > 0 && text.trim().length > 0 && !testOverLimit && !testing
    const audioSrc = useEphemeralAudioUrl(tested?.audio_hex, tested?.content_type || 'audio/mpeg')

    const rememberTextarea = (event: SyntheticEvent<HTMLTextAreaElement>) => {
        textareaRef.current = event.currentTarget
    }

    const insertArtifact = (snippet: string) => {
        const el = textareaRef.current
        if (!el) {
            setText((current) => `${current}${snippet}`)
            return
        }
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        setText(`${text.slice(0, start)}${snippet}${text.slice(end)}`)
        requestAnimationFrame(() => {
            el.focus()
            const caret = start + snippet.length
            try {
                el.setSelectionRange(caret, caret)
            } catch {
                // setSelectionRange can throw on detached nodes; ignore.
            }
        })
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canTest) return
        setTesting(true)
        setError(null)
        try {
            const request: AdminVoiceTestRequest = { voice_id: voiceId.trim(), text: text.trim() }
            // Only send controls that differ from the MiniMax defaults.
            if (settings.model && settings.model !== DEFAULT_SYNTH_SETTINGS.model) request.model = settings.model as AdminVoiceModel
            if (settings.speed !== DEFAULT_SYNTH_SETTINGS.speed) request.speed = settings.speed
            if (settings.vol !== DEFAULT_SYNTH_SETTINGS.vol) request.vol = settings.vol
            if (settings.pitch !== DEFAULT_SYNTH_SETTINGS.pitch) request.pitch = settings.pitch
            if (settings.emotion) request.emotion = settings.emotion as AdminVoiceEmotion
            if (settings.audioFormat !== DEFAULT_SYNTH_SETTINGS.audioFormat) request.audio_format = settings.audioFormat as AdminVoiceAudioFormat
            if (settings.sampleRate !== DEFAULT_SYNTH_SETTINGS.sampleRate) request.sample_rate = Number(settings.sampleRate) as AdminVoiceSampleRate
            if (settings.languageBoost && settings.languageBoost !== DEFAULT_SYNTH_SETTINGS.languageBoost) request.language_boost = settings.languageBoost

            const response = await apiService.testAdminVoice(request)
            setTested(response)
            notify({ tone: 'success', title: t('admin.voices.synth.toasts.success'), message: response.voice_id })
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.voices.synth.errors.fail')
            setError(message)
            notify({ tone: 'error', title: t('admin.voices.synth.toasts.failed'), message })
        } finally {
            setTesting(false)
        }
    }

    return (
        <Card>
            <form id="voice-synthesis-lab" className="flex flex-col gap-5 p-5" onSubmit={(event) => void handleSubmit(event)}>
                <SectionHeader
                    icon={Play}
                    title="Synthesis lab"
                    tone="ember"
                    right={tested ? <Badge tone="ember">Ephemeral</Badge> : undefined}
                />
                <Field label="Voice ID" helper="Use Test on any library row or paste a system, cloned, or designed voice ID.">
                    <Input
                        value={voiceId}
                        onChange={(event) => onVoiceIdChange(event.target.value)}
                        placeholder="English_expressive_narrator"
                    />
                </Field>
                <Field
                    label="Content input"
                    error={testOverLimit ? `Test content must be ${TEST_TEXT_LIMIT} characters or fewer.` : undefined}
                    helper={`${text.length}/${TEST_TEXT_LIMIT} characters. Returns temporary audio and stores no asset.`}
                >
                    <Textarea
                        value={text}
                        onChange={(event) => {
                            rememberTextarea(event)
                            setText(event.target.value)
                        }}
                        onSelect={rememberTextarea}
                        onFocus={rememberTextarea}
                        placeholder="Write one short passage that proves whether this voice fits the scene."
                    />
                </Field>
                <TextArtifactToolbar onInsert={insertArtifact} />
                <SynthControls settings={settings} onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} />
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        kind="primary"
                        iconLeft={<Icon icon={testing ? Loader2 : Play} size={15} className={testing ? 'animate-spin' : undefined} />}
                        disabled={!canTest}
                    >
                        Test voice
                    </Button>
                </div>

                {tested && (
                    <VoiceResultCard
                        tone="ember"
                        badgeLabel="Test result"
                        voiceId={tested.voice_id}
                        audioSrc={audioSrc}
                        audioTitle="voice test"
                        durationMs={tested.duration_ms}
                        metaLine={buildMetaLine(tested, t)}
                        audioMissingHint="The voice test returned, but the audio could not be decoded."
                    />
                )}
            </form>
        </Card>
    )
}
