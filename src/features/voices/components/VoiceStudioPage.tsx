/**
 * The Voice studio route: always the V2 studio (ElevenLabs voices). The
 * capabilities are read only when signed in; a failed read leaves them null
 * and the studio shows its read-only recipe with a retry.
 *
 * The page spinner covers the first read only. A later read (the editor's
 * retry after a failed one) keeps the studio mounted, so an open preset
 * draft survives it and the answer lands in the open editor.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { useVoiceCapabilities } from '../hooks/useVoiceCapabilities'
import { VoiceStudioV2 } from './VoiceStudioV2'

export function VoiceStudioPage() {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const read = useVoiceCapabilities({ enabled: isAuthenticated })
    // Latched while rendering: once the studio showed, no read unmounts it again.
    const [shown, setShown] = useState(!read.loading)
    if (!shown && !read.loading) setShown(true)
    if (!shown) return <LoadingSpinner message={t('common.loading')} />
    return <VoiceStudioV2 capabilities={read.capabilities} onRetryCapabilities={read.retry} />
}
