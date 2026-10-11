/**
 * Entry points for the LLM profile pages. `LlmProfilesPage` is the user's
 * "Models and profiles"; `AdminLlmProfilesPage` is root's "LLM profiles".
 * State and API calls live in `useLlmProfilesConsole`, layout in
 * `LlmProfilesConsoleView`.
 */
import { useTranslation } from 'react-i18next'
import { Bot, Crown } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { Button, IconTile, PageHeader } from '@/ui/primitives'
import { LlmProfilesConsoleView } from './LlmProfilesConsoleView'
import { useLlmProfilesConsole } from './useLlmProfilesConsole'

export function AdminLlmProfilesPage() { return <LlmProfilesPage systemAdmin /> }

export function LlmProfilesPage({ systemAdmin = false }: { systemAdmin?: boolean }) {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const { setPage } = useNavigation()
    const { authorized, ...state } = useLlmProfilesConsole(systemAdmin)

    if (!authorized) return <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-8">
        <PageHeader title={t(systemAdmin ? 'llmProfiles.rootTitle' : 'llmProfiles.title')}
            subtitle={t(systemAdmin && isAuthenticated ? 'llmProfiles.rootOnly' : 'llmProfiles.loginRequired')}
            icon={<IconTile icon={systemAdmin ? Crown : Bot} tone="arcane" />} />
        {!isAuthenticated && <div><Button onClick={openLoginModal}>{t('admin.common.logIn')}</Button></div>}
    </div>

    return <LlmProfilesConsoleView state={state}
        onManageAppProfiles={!systemAdmin && user?.user_type === 'root' ? () => setPage('admin-llm-profiles') : undefined} />
}
