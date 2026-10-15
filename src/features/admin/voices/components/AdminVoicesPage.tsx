/**
 * Root voice console (D20, 05 §8). Root-gated: the console, and every
 * `/admin/voices/*` request, mounts only for root (AC-R1). Modules mount on
 * first visit and then stay mounted, so in-session work (design previews, lab
 * results) survives switching modules.
 *
 * The open module lives in the URL (`#/admin/voices?module=<module>`), so a
 * reload or a shared link lands on it; `&voice=<key>` with the catalog opens
 * that voice's drawer (the Studio's root "Manage" link).
 */
import { useCallback, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, AudioLines, Bookmark, BookOpenText, Crown, Flag, Library, ListChecks, Mic2, Sparkles, Star, TestTube2 } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { NavigationContext } from '@/app/providers/NavigationProvider'
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
import { TOOL_MODULES, consoleLocation } from '../consoleLocation'

const TAB_ID_BASE = 'admin-voices'
const TOOLS_ID_BASE = 'admin-voice-tools'
type MainModule = 'catalog' | 'create' | 'acceptance' | 'tools'


export function AdminVoicesPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const navigation = useContext(NavigationContext)
    const isRoot = isAuthenticated && user?.user_type === 'root'
    // Read once: later module changes write the URL, never re-seed the console.
    const [start] = useState(() => consoleLocation())
    const replaceHash = navigation?.replaceHash
    const keepInUrl = useCallback((module: ConsoleModule) => replaceHash?.(`#/admin/voices?module=${module}`), [replaceHash])

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
        <VoiceConsoleProvider initialModule={start.module} onModuleChange={keepInUrl}>
            <VoiceConsole initialVoiceKey={start.voiceKey} onOpenStudio={navigation ? () => navigation.setPage('voice-studio') : undefined} />
        </VoiceConsoleProvider>
    )
}

function VoiceConsole({ initialVoiceKey, onOpenStudio }: { initialVoiceKey: string | null; onOpenStudio?: () => void }) {
    const { t } = useTranslation()
    const { module, setModule, labHandoff, acceptanceHandoff, configIssue, dismissConfigIssue } = useVoiceConsole()
    const [referenceOpen, setReferenceOpen] = useState(false)
    const [visited, setVisited] = useState<ReadonlySet<ConsoleModule>>(() => new Set([module]))
    if (!visited.has(module)) setVisited(new Set([...visited, module]))
    // "Tools" reopens the tool used last, not always the first one.
    const [lastTool, setLastTool] = useState<ConsoleModule>(() => (TOOL_MODULES.includes(module) ? module : 'defaults'))
    if (TOOL_MODULES.includes(module) && module !== lastTool) setLastTool(module)

    const tabs: TabOption<MainModule>[] = [
        { value: 'catalog', label: t('admin.voices.nav.catalog'), icon: <Icon icon={ListChecks} size={16} /> },
        { value: 'create', label: t('admin.voices.nav.create'), icon: <Icon icon={Sparkles} size={16} /> },
        { value: 'acceptance', label: t('admin.voices.nav.acceptance'), icon: <Icon icon={Star} size={16} /> },
        { value: 'tools', label: t('admin.voices.workspace.tools'), icon: <Icon icon={TestTube2} size={16} /> },
    ]
    const tools: TabOption<ConsoleModule>[] = [
        { value: 'defaults', label: t('admin.voices.nav.defaults'), icon: <Icon icon={Mic2} size={16} /> },
        { value: 'globalPresets', label: t('admin.voices.modules.globalPresets'), icon: <Icon icon={Bookmark} size={16} /> },
        { value: 'library', label: t('admin.voices.nav.library'), icon: <Icon icon={Library} size={16} /> },
        { value: 'lab', label: t('admin.voices.nav.lab'), icon: <Icon icon={TestTube2} size={16} /> },
        { value: 'metrics', label: t('admin.voices.nav.metrics'), icon: <Icon icon={Activity} size={16} /> },
        { value: 'reports', label: t('admin.voices.modules.reports'), icon: <Icon icon={Flag} size={16} /> },
    ]

    const isTool = TOOL_MODULES.includes(module)
    const mainModule: MainModule = isTool ? 'tools' : module as MainModule
    const panel = (value: ConsoleModule, content: ReactNode, tool = false) => (
        <TabPanel value={value} idBase={tool ? TOOLS_ID_BASE : TAB_ID_BASE} active={module}>
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
                // Creation is a module tab; the header goes where root checks the result: the users' Studio.
                actions={onOpenStudio && (
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={AudioLines} size={15} />} onClick={onOpenStudio}>
                        {t('admin.voices.page.openStudio')}
                    </Button>
                )}
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
                value={mainModule}
                onChange={(value) => setModule(value === 'tools' ? lastTool : value)}
                idBase={TAB_ID_BASE}
                aria-label={t('admin.voices.page.modulesAria')}
                variant="pill"
                // A phone scrolls the tab strip, never the page.
                className="overflow-x-auto"
            />

            {panel('catalog', <CatalogManager initialVoiceKey={initialVoiceKey} />)}
            {panel('acceptance', <AcceptanceModule key={acceptanceHandoff.nonce} initialVoiceKey={acceptanceHandoff.voiceKey} />)}
            {panel('create', <CreateModule />)}
            <TabPanel value="tools" idBase={TAB_ID_BASE} active={mainModule}>
                <div className="flex flex-col gap-4">
                    <p className="font-ui text-body text-parchment-300">{t('admin.voices.workspace.toolsHelp')}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <LimitsWidget />
                        <Button variant="secondary" size="sm" aria-haspopup="dialog" iconLeft={<Icon icon={BookOpenText} size={15} />} onClick={() => setReferenceOpen(true)}>
                            {t('admin.voices.page.reference')}
                        </Button>
                    </div>
                    <Tabs options={tools} value={module} onChange={setModule} idBase={TOOLS_ID_BASE} aria-label={t('admin.voices.workspace.tools')} size="sm"
                        className="overflow-x-auto overflow-y-hidden" />
                    {panel('defaults', <DefaultsModule />, true)}
                    {panel('globalPresets', <GlobalPresetsModule />, true)}
                    {panel('library', <LibraryBrowser />, true)}
                    {panel('lab', <SynthLab key={labHandoff.nonce} initialVoiceKey={labHandoff.voiceKey} />, true)}
                    {panel('metrics', <MetricsModule />, true)}
                    {panel('reports', <MinorReportsModule />, true)}
                </div>
            </TabPanel>

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
