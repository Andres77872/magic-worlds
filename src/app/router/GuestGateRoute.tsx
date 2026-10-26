import { useTranslation } from 'react-i18next'
import type { PageType } from '@/shared/types'
import { GuestGate } from '@/features/auth/GuestGate'
import { useAuth, useNavigation } from '../hooks'
import type { GuestGateKind } from './pageAccess'

/** The gated page's own nav label, so the invitation names where the guest is. */
const EYEBROW_KEYS: Partial<Record<PageType, string>> = {
    library: 'library.nav',
    'gallery-lorebooks': 'sidebar.nav.lorebooks',
    'gallery-resources': 'sidebar.nav.resources',
    'gallery-stories': 'sidebar.nav.stories',
    'gallery-media': 'sidebar.nav.media',
    chatroom: 'sidebar.nav.chatroom',
    'active-adventures': 'sidebar.nav.activeAdventures',
    calls: 'sidebar.nav.calls',
    notifications: 'sidebar.nav.notifications',
}

export function GuestGateRoute({ page, kind }: { page: PageType; kind: GuestGateKind }) {
    const { t } = useTranslation()
    const { openLoginModal } = useAuth()
    const { setPage } = useNavigation()
    return (
        <GuestGate
            kind={kind}
            eyebrow={t(EYEBROW_KEYS[page] ?? 'library.nav')}
            onSignUp={() => openLoginModal('register')}
            onSignIn={() => openLoginModal('login')}
            onExplore={() => setPage('landing')}
        />
    )
}
