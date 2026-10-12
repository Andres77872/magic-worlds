/**
 * Entry points for the image profile pages. `ImageProfilesPage` is the user's
 * "Image models"; `AdminImageProfilesPage` is root's "Image profiles". State
 * and API calls live in `useImageProfilesConsole`, layout in `ImageProfilesView`.
 */
import { useTranslation } from 'react-i18next'
import { Crown, ImageIcon } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { Button, IconTile, PageHeader } from '@/ui/primitives'
import { ImageProfilesView } from './ImageProfilesView'
import { useImageProfilesConsole } from './useImageProfilesConsole'

export function AdminImageProfilesPage() { return <ImageProfilesPage systemAdmin /> }

export function ImageProfilesPage({ systemAdmin = false }: { systemAdmin?: boolean }) {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const { setPage } = useNavigation()
    const { authorized, ...state } = useImageProfilesConsole(systemAdmin)

    if (!authorized) return <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-8">
        <PageHeader title={t(systemAdmin ? 'imageProfiles.rootTitle' : 'imageProfiles.title')}
            subtitle={t(systemAdmin && isAuthenticated ? 'imageProfiles.rootOnly' : 'imageProfiles.loginRequired')}
            icon={<IconTile icon={systemAdmin ? Crown : ImageIcon} tone="arcane" />} />
        {!isAuthenticated && <div><Button onClick={openLoginModal}>{t('admin.common.logIn')}</Button></div>}
    </div>

    return <ImageProfilesView state={state}
        onManageAppProfiles={!systemAdmin && user?.user_type === 'root' ? () => setPage('admin-image-profiles') : undefined} />
}
