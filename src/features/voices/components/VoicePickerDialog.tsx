/**
 * The voice picker (09 §3): `VoicePickerElevenLabs` (presets and catalog, V2
 * picks only) for every caller. The capabilities (the preview tier) are read
 * only once the picker opens; the shared 60 s cache is usually warm by then. A
 * failed read leaves them null and previews start from Standard.
 */
import type { EffectiveVoice, StoredCharacterVoice } from '@/shared'
import type { CatalogRecommendationTarget } from '../hooks/useCatalogBrowser'
import { useVoiceCapabilities } from '../hooks/useVoiceCapabilities'
import { VoicePickerElevenLabs } from './VoicePickerElevenLabs'

interface VoicePickerDialogProps {
    open: boolean
    currentVoice?: StoredCharacterVoice | null
    /** The current voice's read-only projection (D35): badges and "Plays as". */
    currentEffectiveVoice?: EffectiveVoice | null
    /** A saved, non-persona character card: "Recommended for this character" in the catalog. */
    recommendedFor?: CatalogRecommendationTarget | null
    /** The card or story language (catalog badges and samples). */
    language?: string | null
    onSelect: (voice: StoredCharacterVoice | null) => void
    onClose: () => void
}

export function VoicePickerDialog(props: VoicePickerDialogProps) {
    const { capabilities } = useVoiceCapabilities({ enabled: props.open })
    return (
        <VoicePickerElevenLabs
            open={props.open}
            currentVoice={props.currentVoice}
            currentEffectiveVoice={props.currentEffectiveVoice}
            recommendedFor={props.recommendedFor}
            language={props.language}
            capabilities={capabilities}
            onSelect={props.onSelect}
            onClose={props.onClose}
        />
    )
}
