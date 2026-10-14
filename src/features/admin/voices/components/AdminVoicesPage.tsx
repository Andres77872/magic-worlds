/**
 * Root voice console (D20, 05 §8). Root-gated: the console, and every
 * `/admin/voices/*` request, mounts only for root (AC-R1). Modules mount on
 * first visit and then stay mounted, so in-session work (design previews, lab
 * results) survives switching modules.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Bookmark, BookOpenText, Crown, Flag, Library, ListChecks, Mic2, Sparkles, Star, TestTube2 } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { Button, Callout, Icon, IconTile, PageHeader, TabPanel, Tabs, type TabOption } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { AcceptanceModule } from './acceptance/AcceptanceModule'
import { CatalogManager } from './catalog/CatalogManager'
import { CreateModule } from './create/CreateModule'
import { DefaultsModule } from './defaults/DefaultsModule'
import { GlobalPresetsModule } from './globalPresets/GlobalPresetsModule'
import { LibraryBrowser } from './library/LibraryBrowser'
import { SynthLab } from './lab/SynthLab'
import { MetricsModule } from './metrics/MetricsModule'
import { MinorReportsModule } from './reports/MinorReportsModule'
import { LimitsWidget } from './shell/LimitsWidget'
import { VoiceConsoleProvider, useVoiceConsole, type ConsoleModule } from './shell/VoiceConsoleContext'
import { VoiceReferenceDrawer } from './shell/VoiceReferenceDrawer'

const TAB_ID_BASE = 'admin-voices'

export function AdminVoicesPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'

    if (!isAuthenticated) {
        return (
            <RootAccessState
                message={t('admin.voices.access.title')}
                secondaryText={t('admin.voices.access.loginRequired')}
                action={{ label: t('admin.common.logIn'), onClick: openLoginModal }}
            />
        )
    }

    if (!isRoot) {
        return <RootAccessState message={t('admin.voices.access.title')} secondaryText={t('admin.voices.access.rootOnly')} />
    }

    return (
        <VoiceConsoleProvider>
            <VoiceConsole />
        </VoiceConsoleProvider>
    )
}

function VoiceConsole() {
    const { t } = useTranslation()
    const { module, setModule, labHandoff, acceptanceHandoff, configIssue, dismissConfigIssue } = useVoiceConsole()
    const [referenceOpen, setReferenceOpen] = useState(false)
    const [visited, setVisited] = useState<ReadonlySet<ConsoleModule>>(() => new Set([module]))
    if (!visited.has(module)) setVisited(new Set([...visited, module]))

    const tabs: TabOption<ConsoleModule>[] = [
        { value: 'catalog', label: t('admin.voices.nav.catalog'), icon: <Icon icon={ListChecks} size={16} /> },
        { value: 'acceptance', label: t('admin.voices.nav.acceptance'), icon: <Icon icon={Star} size={16} /> },
        { value: 'defaults', label: t('admin.voices.nav.defaults'), icon: <Icon icon={Mic2} size={16} /> },
        { value: 'globalPresets', label: t('admin.voices.modules.globalPresets'), icon: <Icon icon={Bookmark} size={16} /> },
        { value: 'library', label: t('admin.voices.nav.library'), icon: <Icon icon={Library} size={16} /> },
        { value: 'create', label: t('admin.voices.nav.create'), icon: <Icon icon={Sparkles} size={16} /> },
        { value: 'lab', label: t('admin.voices.nav.lab'), icon: <Icon icon={TestTube2} size={16} /> },
        { value: 'metrics', label: t('admin.voices.nav.metrics'), icon: <Icon icon={Activity} size={16} /> },
        { value: 'reports', label: t('admin.voices.modules.reports'), icon: <Icon icon={Flag} size={16} /> },
    ]

    const panel = (value: ConsoleModule, content: ReactNode) => (
        <TabPanel value={value} idBase={TAB_ID_BASE} active={module}>
            {visited.has(value) ? content : null}
        </TabPanel>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('admin.common.rootConsole')}
                eyebrowTone="arcane"
                icon={<IconTile icon={Crown} tone="arcane" />}
                title={t('admin.voices.page.title')}
                subtitle={t('admin.voices.page.subtitle')}
                size="lg"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <LimitsWidget />
                        <Button
                            variant="secondary"
                            size="sm"
                            aria-haspopup="dialog"
                            iconLeft={<Icon icon={BookOpenText} size={15} />}
                            onClick={() => setReferenceOpen(true)}
                        >
                            {t('admin.voices.page.reference')}
                        </Button>
                    </div>
                }
                divider
            />

            {configIssue && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={
                        <Button variant="secondary" size="sm" onClick={dismissConfigIssue}>
                            {t('admin.voices.configBanner.dismiss')}
                        </Button>
                    }
                >
                    <p className="font-semibold text-fg">{t('admin.voices.configBanner.title')}</p>
                    <p>{configIssue}</p>
                </Callout>
            )}

            <Tabs
                options={tabs}
                value={module}
                onChange={setModule}
                idBase={TAB_ID_BASE}
                aria-label={t('admin.voices.page.modulesAria')}
                variant="pill"
            />

            {panel('catalog', <CatalogManager />)}
            {panel('acceptance', <AcceptanceModule key={acceptanceHandoff.nonce} initialVoiceKey={acceptanceHandoff.voiceKey} />)}
            {panel('defaults', <DefaultsModule />)}
            {panel('globalPresets', <GlobalPresetsModule />)}
            {panel('library', <LibraryBrowser />)}
            {panel('create', <CreateModule />)}
            {panel('lab', <SynthLab key={labHandoff.nonce} initialVoiceKey={labHandoff.voiceKey} />)}
            {panel('metrics', <MetricsModule />)}
            {panel('reports', <MinorReportsModule />)}

            <VoiceReferenceDrawer open={referenceOpen} onClose={() => setReferenceOpen(false)} />
        </div>
    )
}

function RootAccessState({
    message,
    secondaryText,
    action,
}: {
    message: string
    secondaryText: string
    action?: { label: string; onClick: () => void }
}) {
    return (
        <div className="mx-auto flex w-full max-w-[960px] px-4 py-10 sm:px-8">
            <EmptyState icon={<Icon icon={Crown} size={44} />} message={message} secondaryText={secondaryText} button={action} />
        </div>
    )
}
