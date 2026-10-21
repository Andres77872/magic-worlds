/**
 * CallSetup — the call's voice and conversation model, chosen before calling.
 * Shown in the start dialog, and again from the end panel's "Call settings".
 *
 * Voice: the chat's own voice unless the user picked one for calls with this
 * character. The pick is sent with each call (`voice_start.voice`) and
 * remembered per character; the card and the chat are never changed. The
 * picker's catalog lists only voices that work in calls. When the character's
 * voice cannot take calls right now (`voiceUnavailable`), the row says so and
 * "Change voice" becomes the main action.
 *
 * Model: the callbot feature control, passed in as `model` (it reads the
 * profile context). The caller can choose a compatible app profile for new
 * calls in this tab. With nothing assigned, root can set the app default.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Bot, Undo2, Volume2, type LucideIcon } from 'lucide-react'
import type { StoredCharacterVoice } from '@/shared/types'
import { VoicePickerDialog } from '@/features/voices/components/VoicePickerDialog'
import type { CatalogRecommendationTarget } from '@/features/voices/hooks/useCatalogBrowser'
import { Badge, Button, Eyebrow, Icon, cx } from '@/ui/primitives'

export interface CallSetupProps {
    /** The character's name (hint copy). */
    name: string
    /** The chat's own voice (the call's voice without a pick). */
    characterVoice: StoredCharacterVoice | null
    /** The voice picked for calls with this character, or null. */
    pick: StoredCharacterVoice | null
    onPick: (voice: StoredCharacterVoice | null) => void
    /** The voice the call would use cannot take calls right now. */
    voiceUnavailable?: boolean
    /** Card language for the picker's catalog filter and samples. */
    language?: string | null
    recommendedFor?: CatalogRecommendationTarget | null
    /** The conversation-model control (callbot), as a setting row (`LlmFeatureControl variant="setting"`). */
    model?: ReactNode
    disabled?: boolean
    className?: string
}

export function CallSetup({
    name,
    characterVoice,
    pick,
    onPick,
    voiceUnavailable = false,
    language = null,
    recommendedFor = null,
    model,
    disabled = false,
    className,
}: CallSetupProps) {
    const { t } = useTranslation()
    const [pickerOpen, setPickerOpen] = useState(false)
    const voice = pick ?? characterVoice
    const voiceName = voice?.voice_name?.trim() || t('call.setup.defaultVoice')

    return (
        <section
            aria-label={t('call.setup.title')}
            className={cx('flex flex-col gap-3 rounded-lg border border-parchment-50/10 bg-ink-700/60 p-4', className)}
            data-testid="call-setup"
        >
            <Eyebrow tone="muted">{t('call.setup.title')}</Eyebrow>

            <div className="flex flex-col divide-y divide-parchment-50/[.08]">
                <SetupRow icon={Volume2} label={t('call.setup.voice')}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <p className="flex min-w-0 flex-[1_1_10rem] flex-wrap items-center gap-x-2 gap-y-1 text-body text-parchment-50">
                            <span className="min-w-0 break-words" data-testid="call-setup-voice">{voiceName}</span>
                            {pick && <Badge tone="neutral">{t('call.setup.forCalls')}</Badge>}
                        </p>
                        <Button variant={voiceUnavailable ? 'primary' : 'secondary'} size="sm" onClick={() => setPickerOpen(true)} disabled={disabled}>
                            {t('call.setup.change')}
                        </Button>
                    </div>
                    {voiceUnavailable ? (
                        <p role="status" className="mt-1 flex items-start gap-1.5 text-caption text-amber-500" data-testid="call-setup-voice-unavailable">
                            <Icon icon={AlertTriangle} size={13} className="mt-0.5 shrink-0" />
                            <span>{t('call.setup.voiceUnavailable')}</span>
                        </p>
                    ) : pick ? (
                        <p className="mt-1 text-caption text-parchment-400">{t('call.setup.pickHint', { name })}</p>
                    ) : null}
                    {pick && (
                        <Button variant="ghost" size="xs" className="-ml-2.5 mt-1" iconLeft={<Icon icon={Undo2} size={13} />} onClick={() => onPick(null)} disabled={disabled}>
                            {t('call.setup.useCharacterVoice')}
                        </Button>
                    )}
                </SetupRow>

                {model && (
                    <SetupRow icon={Bot} label={t('call.setup.model')}>
                        {model}
                    </SetupRow>
                )}
            </div>

            <VoicePickerDialog
                open={pickerOpen}
                currentVoice={voice}
                language={language}
                recommendedFor={recommendedFor}
                worksInCalls
                onSelect={(selected) => {
                    // "No voice" in the picker means: back to the character's own voice.
                    onPick(selected && selected.voice_key !== characterVoice?.voice_key ? selected : null)
                    setPickerOpen(false)
                }}
                onClose={() => setPickerOpen(false)}
            />
        </section>
    )
}

/** One setting: an arcane glyph (the AI side), its label, then the host's value row. */
function SetupRow({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-arcane-500/15 text-arcane-300">
                <Icon icon={icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-label text-parchment-300">{label}</p>
                {children}
            </div>
        </div>
    )
}
