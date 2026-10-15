import { useTranslation } from 'react-i18next'
import { Tag } from '@/ui/primitives'

/** Missing providers are legacy ElevenLabs rows; keep unfamiliar admin providers visible as supplied. */
export function VoiceProviderTag({ provider }: { provider?: string | null }) {
    const { t } = useTranslation()
    const id = provider ?? 'elevenlabs'
    const label = id === 'fish_audio' ? 'Fish Audio' : id === 'elevenlabs' ? 'ElevenLabs' : id

    return (
        <Tag data-voice-provider={id} title={t('voices.catalog.providerTag', { provider: label })}>
            {label}
        </Tag>
    )
}
