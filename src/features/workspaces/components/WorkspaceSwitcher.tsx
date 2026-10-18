/**
 * The visible workspace switcher in the sidebar header (document 08
 * "Information architecture"): the current workspace's name, the active
 * workspaces, an archived section (opens read-only), Create workspace and
 * Manage. Switching goes through the navigation coordinator (guards, live
 * call, revalidation) and lands per `switchDestination`.
 *
 * `WorkspaceSwitcherView` is the pure anchored menu (stories, tests);
 * `WorkspaceSwitcher` wires it to the workspace and navigation state and owns
 * the create/edit/manage dialogs. Renders nothing while the R1 UI is off or no
 * workspace is selected.
 */
import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, Layers, Loader2, Plus, Settings2 } from 'lucide-react'
import { useNavigation } from '@/app/hooks/useNavigation'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { Workspace } from '@/shared/types'
import { Badge, Eyebrow, Icon, Tooltip, cx } from '@/ui/primitives'
import { useNavigationCoordinator } from '../useNavigationCoordinator'
import { useWorkspaceActions } from '../useWorkspaceActions'
import { switchDestination, preferredLandingPage } from '../workspaceRouting'
import { WorkspaceFormDialog } from './WorkspaceFormDialog'
import { WorkspaceManageDialog } from './WorkspaceManageDialog'

const MENU_TRANSITION_MS = 200

interface WorkspaceSwitcherViewProps {
    workspaces: readonly Workspace[]
    selectedWorkspaceId: string | null
    /** The destination while a switch ends a call / revalidates. */
    switchingTo?: string | null
    /** Icon-only trigger (collapsed rail). */
    collapsed?: boolean
    /** Full-width row inside the mobile drawer. */
    panel?: boolean
    onSelect: (workspace: Workspace) => void
    onCreate: () => void
    onManage: () => void
    defaultOpen?: boolean
}

function MenuRow({
    label,
    icon,
    checked,
    badge,
    onClick,
    radio = false,
}: {
    label: string
    icon: typeof Layers
    checked?: boolean
    badge?: string
    onClick: () => void
    radio?: boolean
}) {
    return (
        <button
            type="button"
            role={radio ? 'menuitemradio' : 'menuitem'}
            aria-checked={radio ? Boolean(checked) : undefined}
            onClick={onClick}
            title={label}
            className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                checked ? 'bg-ember-500/15 text-ember-400' : 'text-parchment-100 hover:bg-parchment-50/[.05] hover:text-parchment-50',
            )}
        >
            <Icon icon={icon} size={17} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {badge && <Badge tone="neutral" className="shrink-0">{badge}</Badge>}
            {radio && checked && <Icon icon={Check} size={15} className="shrink-0" />}
        </button>
    )
}

export function WorkspaceSwitcherView({
    workspaces,
    selectedWorkspaceId,
    switchingTo = null,
    collapsed = false,
    panel = false,
    onSelect,
    onCreate,
    onManage,
    defaultOpen = false,
}: WorkspaceSwitcherViewProps) {
    const { t } = useTranslation()
    const [open, setOpenState] = useState(defaultOpen)
    // Kept mounted through the fade out. Set only from handlers: a state update
    // issued during render was dropped by the next re-render (StrictMode), which
    // unmounted the menu right after it first opened.
    const [closing, setClosing] = useState(false)
    const [entered, setEntered] = useState(false)
    const closeTimerRef = useRef<number | undefined>(undefined)
    const containerRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const mounted = open || closing

    const setOpen = useCallback((next: boolean) => {
        window.clearTimeout(closeTimerRef.current)
        if (next) {
            setClosing(false)
            setOpenState(true)
            return
        }
        if (!open) return
        setOpenState(false)
        setEntered(false)
        setClosing(true)
        closeTimerRef.current = window.setTimeout(() => setClosing(false), MENU_TRANSITION_MS)
    }, [open])
    useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

    const selected = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    const active = workspaces.filter((workspace) => workspace.archived_at === null)
    const archived = workspaces.filter((workspace) => workspace.archived_at !== null)
    const name = selected?.name ?? t('workspaceUi.switcher.label')
    const switching = switchingTo !== null

    useEffect(() => {
        if (!open) return
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const handleKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return
            setOpen(false)
            triggerRef.current?.focus()
        }
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [open, setOpen])

    // Fade in on the frame after the menu mounts; closing keeps it mounted through the fade out.
    useEffect(() => {
        if (!open) return
        const id = requestAnimationFrame(() => setEntered(true))
        return () => cancelAnimationFrame(id)
    }, [open])

    useEffect(() => {
        if (!open) return
        const current = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
            ?? menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')
        current?.focus()
    }, [open])

    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
        if (items.length === 0) return
        event.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLElement)
        const delta = event.key === 'ArrowDown' ? 1 : -1
        items[(index + delta + items.length) % items.length]?.focus()
    }

    const choose = (workspace: Workspace) => {
        setOpen(false)
        if (workspace.id !== selectedWorkspaceId) onSelect(workspace)
    }

    const menuPlacement = panel
        ? 'left-0 right-0 top-full mt-2 origin-top'
        : cx('left-0 top-full mt-2 origin-top-left', collapsed ? 'lg:left-full lg:top-0 lg:mt-0 lg:ml-3' : '')

    return (
        <div ref={containerRef} className={cx('relative', panel || !collapsed ? 'w-full' : '')}>
            <Tooltip
                label={t('workspaceUi.switcher.open', { name })}
                disabled={panel || !collapsed || open}
                wrapperClassName="flex w-full items-center justify-center"
            >
                <button
                    ref={triggerRef}
                    type="button"
                    aria-label={t('workspaceUi.switcher.open', { name })}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    className={cx(
                        'inline-flex h-10 shrink-0 items-center gap-2.5 rounded-md border border-parchment-50/10 font-ui text-sm font-semibold text-parchment-100 transition-colors hover:border-ember-500/40 hover:text-parchment-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                        panel
                            ? 'w-full justify-start px-3'
                            : cx('w-10 justify-center px-0', !collapsed && 'lg:w-full lg:justify-start lg:px-3'),
                        open && 'border-ember-500/40 bg-ember-500/10',
                    )}
                >
                    <Icon icon={switching ? Loader2 : Layers} size={18} className={cx('shrink-0 text-ember-400', switching && 'animate-spin motion-reduce:animate-none')} />
                    <span className={cx('min-w-0 flex-1 truncate text-left', panel ? 'inline' : cx('hidden', !collapsed && 'lg:inline'))}>
                        {switching ? t('workspaceUi.switcher.switching') : name}
                    </span>
                    {selected?.archived_at && (
                        <Badge tone="warning" className={cx('shrink-0', panel ? 'inline-flex' : cx('hidden', !collapsed && 'lg:inline-flex'))}>
                            {t('workspaceUi.switcher.readOnly')}
                        </Badge>
                    )}
                    <Icon icon={ChevronsUpDown} size={15} className={cx('shrink-0 text-parchment-400', panel ? 'inline' : cx('hidden', !collapsed && 'lg:inline'))} />
                </button>
            </Tooltip>

            {mounted && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={t('workspaceUi.switcher.heading')}
                    onKeyDown={handleMenuKeyDown}
                    className={cx(
                        'absolute z-50 flex max-h-[min(30rem,calc(100vh-6rem))] w-[min(17rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-xl border border-parchment-50/10 bg-ink-800 text-left shadow-xl transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                        panel && 'w-auto',
                        menuPlacement,
                        entered ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[.98] opacity-0',
                    )}
                >
                    <div className="px-3 pb-1 pt-2.5">
                        <Eyebrow tone="muted">{t('workspaceUi.switcher.heading')}</Eyebrow>
                    </div>
                    <div className="flex flex-col gap-0.5 p-1.5">
                        {active.map((workspace) => (
                            <MenuRow
                                key={workspace.id}
                                radio
                                icon={Layers}
                                label={workspace.name}
                                checked={workspace.id === selectedWorkspaceId}
                                badge={workspace.is_default ? t('workspaceUi.switcher.defaultBadge') : undefined}
                                onClick={() => choose(workspace)}
                            />
                        ))}
                    </div>
                    {archived.length > 0 && (
                        <div className="border-t border-parchment-50/10 p-1.5">
                            <div className="px-2 pb-1 pt-1">
                                <Eyebrow tone="muted">{t('workspaceUi.switcher.archived')}</Eyebrow>
                            </div>
                            {archived.map((workspace) => (
                                <MenuRow
                                    key={workspace.id}
                                    radio
                                    icon={Layers}
                                    label={workspace.name}
                                    checked={workspace.id === selectedWorkspaceId}
                                    badge={t('workspaceUi.switcher.readOnly')}
                                    onClick={() => choose(workspace)}
                                />
                            ))}
                        </div>
                    )}
                    <div className="flex flex-col gap-0.5 border-t border-parchment-50/10 p-1.5">
                        <MenuRow icon={Plus} label={t('workspaceUi.switcher.create')} onClick={() => { setOpen(false); onCreate() }} />
                        <MenuRow icon={Settings2} label={t('workspaceUi.switcher.manage')} onClick={() => { setOpen(false); onManage() }} />
                    </div>
                </div>
            )}
        </div>
    )
}

interface WorkspaceSwitcherProps {
    collapsed?: boolean
    panel?: boolean
    /** Called after a switch or dialog opens, so the mobile drawer can close. */
    onNavigate?: () => void
}

export function WorkspaceSwitcher({ collapsed = false, panel = false, onNavigate }: WorkspaceSwitcherProps) {
    const workspace = useContext(WorkspaceContext)
    if (!workspace || workspace.status !== 'ready' || !workspace.selectedWorkspaceId) return null
    return <ConnectedWorkspaceSwitcher collapsed={collapsed} panel={panel} onNavigate={onNavigate} />
}

function ConnectedWorkspaceSwitcher({ collapsed, panel, onNavigate }: Required<Pick<WorkspaceSwitcherProps, 'collapsed' | 'panel'>> & Pick<WorkspaceSwitcherProps, 'onNavigate'>) {
    const workspace = useContext(WorkspaceContext)!
    const { currentPage, currentHash } = useNavigation()
    const { navigate, switchingTo } = useNavigationCoordinator()
    const actions = useWorkspaceActions()
    const [formTarget, setFormTarget] = useState<Workspace | 'new' | null>(null)
    const [manageOpen, setManageOpen] = useState(false)

    const open = (target: Workspace, landing = false) => {
        const destination = landing
            ? { page: preferredLandingPage(target), hash: undefined }
            : switchDestination(currentPage, target) ?? { page: currentPage, hash: currentHash }
        void navigate({ page: destination.page, hash: destination.hash, workspace: target })
        onNavigate?.()
    }

    // Always edit the latest known version: a conflict reloads the list before the next save.
    const editing = formTarget !== null && formTarget !== 'new'
        ? workspace.workspaces.find((item) => item.id === formTarget.id) ?? formTarget
        : null

    return (
        <>
            <WorkspaceSwitcherView
                workspaces={workspace.workspaces}
                selectedWorkspaceId={workspace.selectedWorkspaceId}
                switchingTo={switchingTo}
                collapsed={collapsed}
                panel={panel}
                onSelect={(target) => open(target)}
                onCreate={() => setFormTarget('new')}
                onManage={() => setManageOpen(true)}
            />
            <WorkspaceManageDialog
                open={manageOpen && formTarget === null}
                onClose={() => setManageOpen(false)}
                workspaces={workspace.workspaces}
                selectedWorkspaceId={workspace.selectedWorkspaceId}
                onOpenWorkspace={(target) => {
                    setManageOpen(false)
                    open(target)
                }}
                onEdit={(target) => setFormTarget(target)}
                onCreate={() => setFormTarget('new')}
                onArchive={actions.archive}
                onRestore={actions.restore}
            />
            <WorkspaceFormDialog
                open={formTarget !== null}
                workspace={editing}
                onClose={() => setFormTarget(null)}
                onSubmit={(values) => (editing ? actions.update(editing, values) : actions.create(values))}
                onSaved={(saved) => {
                    // A new workspace opens at its preferred landing page (guards still apply).
                    if (!editing) {
                        setManageOpen(false)
                        open(saved, true)
                    }
                }}
            />
        </>
    )
}
