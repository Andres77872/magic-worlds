/**
 * "▶ Play sample" on the character editor's voice field (R1-FE-03, AC-C7):
 * plays the voice the card is heard as, as that voice's free catalog sample
 * (D18). The audition is unmetered and only reads, so the editor renders it
 * outside its archived-workspace `ReadOnlyFieldset`: there the field and the
 * picker are read-only, but samples still play (05 §7.9). The host renders
 * it only when the voice carries a projection.
 *
 * Its accessible name says the voice and, once the sample is resolved, its
 * language ("Play sample of Maren, English", 05 §10 "Audio controls"); the
 * button toggles `aria-pressed` while it plays.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Square } from 'lucide-react'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { Button, Icon, cx } from '@/ui/primitives'
import { useVoiceSample } from '../hooks/useVoiceSample'
import { languageLabel } from './VoiceBadges'

interface VoiceFieldSampleProps {
    /** The catalog voice the card plays as (`effective_voice.voice_key`). */
    voiceKey: string
    /** Its display name, until the catalog read names it. */
    name: string
    /** The sample language (the stored voice's), else the voice's primary one. */
    language?: string | null
    className?: string
}

export function VoiceFieldSample({ voiceKey, name, language = null, className }: VoiceFieldSampleProps) {
    const { t, i18n } = useTranslation()
    const sample = useVoiceSample({ voiceKey, language, scope: 'voice-field' })
    const heardName = sample.heard?.name || name
    const label = sample.heard?.language
        ? t('voices.catalog.playSampleIn', { name: heardName, language: languageLabel(sample.heard.language, i18n.language) })
        : t('voices.catalog.playSample', { name: heardName })
    return (
        <div className={cx('flex flex-col items-start gap-2', className)} data-testid="voice-field-sample">
            <Button
                variant="ghost"
                size="sm"
                aria-pressed={sample.playing}
                aria-label={label}
                iconLeft={<Icon icon={sample.loading ? Loader2 : sample.playing ? Square : Play} size={14} className={sample.loading ? 'animate-spin' : undefined} />}
                onClick={() => (sample.playing || sample.loading ? sample.stop() : void sample.listen())}
            >
                {t('voices.catalog.sampleButton')}
            </Button>
            {sample.clip && <VoiceClipPlayer className="w-full" src={sample.clip.src} volume={sample.clip.volume} autoPlay title={t('voices.catalog.playSample', { name: heardName })} />}
            {sample.error && <p role="alert" className="font-ui text-caption text-blood-300">{sample.error}</p>}
        </div>
    )
}
