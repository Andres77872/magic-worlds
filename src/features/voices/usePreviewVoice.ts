/**
 * Shared hook for the user voice studio + character picker: synthesize a short
 * sample via the non-root /voice-presets/preview endpoint and expose it as an
 * object URL (lifecycle managed by useEphemeralAudioUrl).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { VoicePresetPreviewRequest } from '@/shared'
import { useEphemeralAudioUrl } from '@/features/admin/voices/hexAudio'

const DEFAULT_PREVIEW_TEXT = 'The candle gutters low as the hidden door opens.'

export function usePreviewVoice() {
    const { t } = useTranslation()
    const [hex, setHex] = useState<string | null>(null)
    const [mime, setMime] = useState('audio/mpeg')
    const [previewing, setPreviewing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const src = useEphemeralAudioUrl(hex, mime)

    const runPreview = async (request: VoicePresetPreviewRequest) => {
        setPreviewing(true)
        setError(null)
        try {
            const response = await apiService.previewVoice({
                ...request,
                text: request.text.trim() || DEFAULT_PREVIEW_TEXT,
            })
            setMime(response.content_type || 'audio/mpeg')
            setHex(response.audio_hex)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('voices.preview.error'))
        } finally {
            setPreviewing(false)
        }
    }

    return { src, previewing, error, runPreview, DEFAULT_PREVIEW_TEXT }
}
