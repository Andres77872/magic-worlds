/**
 * The Voice studio route: the shared Fish Audio / ElevenLabs catalog and saved settings. The
 * capabilities are read only when signed in; a failed read leaves them null
 * and the studio shows its read-only recipe with a retry.
 *
 * Root also gets the console shortcuts: create a voice, manage the catalog,
 * and manage one catalog voice (its drawer in the console).
 *
 * The page spinner covers the first read only. A later read (the editor's
 * retry after a failed one) keeps the studio mounted, so an open preset
 * draft survives it and the answer lands in the open editor.
 */
import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/hooks'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { useVoiceCapabilities } from '../hooks/useVoiceCapabilities'
import { VoiceStudioV2 } from './VoiceStudioV2'

export function VoiceStudioPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user } = useAuth()
    const navigation = useContext(NavigationContext)
    const read = useVoiceCapabilities({ enabled: isAuthenticated })
    // Latched while rendering: once the studio showed, no read unmounts it again.
    const [shown, setShown] = useState(!read.loading)
    if (!shown && !read.loading) setShown(true)
    if (!shown) return <LoadingSpinner message={t('common.loading')} />
    const root = user?.user_type === 'root' && navigation
    const initialTab = new URLSearchParams(window.location.hash.split('?')[1]).get('view') === 'saved' ? 'saved' : 'catalog'
    return <VoiceStudioV2 capabilities={read.capabilities} onRetryCapabilities={read.retry} initialTab={initialTab}
        // The open tab stays in the URL, so a reload or a shared link lands on it.
        onTabChange={navigation ? (tab) => navigation.replaceHash(tab === 'saved' ? '#/voices?view=saved' : '#/voices') : undefined}
        onCreateVoice={root ? () => navigation.setPage('admin-voices', { hash: '#/admin/voices?module=create&provider=fish_audio' }) : undefined}
        onManageVoices={root ? () => navigation.setPage('admin-voices', { hash: '#/admin/voices?module=catalog' }) : undefined}
        onManageVoice={root ? (voice) => navigation.setPage('admin-voices', {
            hash: `#/admin/voices?module=catalog&voice=${encodeURIComponent(voice.voice_key)}`,
        }) : undefined} />
}
