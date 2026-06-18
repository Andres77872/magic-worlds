/**
 * Account & settings menu — the anchored popover behind the sidebar avatar.
 * Consolidates the low-frequency identity / settings / meta actions that used to
 * stack as separate rail rows (Profile, Language, Docs, View source, the root
 * admin links and Log out), decluttering the footer to a glanceable few.
 *
 * Mirrors the LanguageMenu / ApiStatusMonitor idiom: anchored (not portaled, so
 * it keeps the simple outside-pointerdown + Escape dismissal) and rises/drops in
 * with the app's overlay motion. It owns the whole logout flow (the confirm
 * dialog lives here). Rendered in both auth states so Docs / View source /
 * Language stay reachable when signed out.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Bot,
    Check,
    CircleUserRound,
    Code2,
    Crown,
    Globe,
    Info,
    Loader2,
    LogIn,
    LogOut,
    Ticket,
    UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { effectiveName } from '@/utils/displayName'
import { useAuth, useLanguage, useNavigation } from '../../app/hooks'
import { SUPPORTED_LANGUAGE_OPTIONS } from '../../app/i18n'
import { Avatar, Eyebrow, Icon, Tooltip, cx } from '../primitives'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

// Matches the Drawer/LanguageMenu transition so the menu shares the app idiom.
const MENU_TRANSITION_MS = 200

type Placement = 'rise' | 'drop'

interface SidebarAccountMenuProps {
    /** Icon-only trigger (collapsed rail). Ignored for the `drop` placement. */
    collapsed?: boolean
    /** `rise` = sidebar footer (opens up-right); `drop` = top bar (opens down-right). */
    placement?: Placement
    /** Called after a navigation so an open mobile drawer can close itself. */
    onNavigate?: () => void
    /** Start with the menu open (stories / tests). */
    defaultOpen?: boolean
}

function AccountMenuRow({
    icon,
    label,
    onClick,
    href,
    danger = false,
    current = false,
    title,
    trailing,
}: {
    icon: LucideIcon
    label: string
    onClick?: () => void
    href?: string
    danger?: boolean
    current?: boolean
    title?: string
    trailing?: ReactNode
}) {
    const className = cx(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
        current
            ? 'bg-ember-500/15 text-ember-400'
            : danger
              ? 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-blood-500'
              : 'text-parchment-100 hover:bg-parchment-50/[.05] hover:text-parchment-50',
    )
    const body = (
        <>
            <Icon icon={icon} size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {trailing}
        </>
    )
    if (href) {
        return (
            <a
                role="menuitem"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={title ?? label}
                onClick={onClick}
                className={className}
            >
                {body}
            </a>
        )
    }
    return (
        <button
            type="button"
            role="menuitem"
            aria-label={label}
            aria-current={current ? 'page' : undefined}
            title={title ?? label}
            onClick={onClick}
            className={className}
        >
            {body}
        </button>
    )
}

export function SidebarAccountMenu({
    collapsed = false,
    placement = 'rise',
    onNavigate,
    defaultOpen = false,
}: SidebarAccountMenuProps) {
    const { t } = useTranslation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()
    const { currentPage, setPage } = useNavigation()
    const { language, isSyncing, syncError, setLanguage } = useLanguage()
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const displayedName = user ? effectiveName(user) : ''
    const triggerLabel = t('sidebar.account.open')
    const visibleLabel = isAuthenticated ? displayedName || t('sidebar.profile') : t('sidebar.account.title')

    const [open, setOpen] = useState(defaultOpen)
    const [mounted, setMounted] = useState(defaultOpen)
    const [entered, setEntered] = useState(false)
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Dismiss on outside pointer-down or Escape (anchored popover, not a modal).
    useEffect(() => {
        if (!open) return
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [open])

    // Rise/scale entrance + exit, mirroring the Drawer mounted/entered rAF idiom.
    useEffect(() => {
        if (open) {
            setMounted(true)
            const id = requestAnimationFrame(() => setEntered(true))
            return () => cancelAnimationFrame(id)
        }
        setEntered(false)
        const timer = window.setTimeout(() => setMounted(false), MENU_TRANSITION_MS)
        return () => window.clearTimeout(timer)
    }, [open])

    // Move focus to the first menu item when the menu opens (keyboard affordance).
    useEffect(() => {
        if (!open) return
        const first = menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')
        first?.focus()
    }, [open])

    // Arrow-key roving focus across the mixed menuitem / menuitemradio rows.
    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
        if (items.length === 0) return
        event.preventDefault()
        const activeIndex = items.indexOf(document.activeElement as HTMLElement)
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = (activeIndex + delta + items.length) % items.length
        items[next]?.focus()
    }

    const close = () => setOpen(false)

    const navigate = (page: PageType) => {
        setPage(page)
        close()
        onNavigate?.()
    }

    const handleSelectLanguage = (code: (typeof SUPPORTED_LANGUAGE_OPTIONS)[number]['code']) => {
        if (code !== language) void setLanguage(code)
    }

    const confirmLogout = () => {
        setConfirmLogoutOpen(false)
        logout()
    }

    const onProfile = currentPage === 'profile'
    const containerClassName = cx('relative', placement === 'rise' && 'w-full')
    const menuPlacement =
        placement === 'rise'
            ? 'bottom-0 left-full ml-3 origin-bottom-left'
            : 'right-0 top-full mt-2 origin-top-right'
    const enterFrom = placement === 'rise' ? 'translate-y-1' : '-translate-y-1'

    return (
        <div ref={containerRef} className={containerClassName}>
            <Tooltip
                label={visibleLabel}
                disabled={placement !== 'rise' || !collapsed}
                wrapperClassName={placement === 'rise' ? 'w-full items-center justify-center' : undefined}
            >
                <button
                    type="button"
                    aria-label={triggerLabel}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    title={visibleLabel}
                    onClick={() => setOpen((current) => !current)}
                    className={cx(
                        // The base classes ARE the icon-only state — a centered 40px circle,
                        // concentric with the round avatar. `cx` is a plain joiner (not
                        // tailwind-merge), so the rail must never carry a conflicting `lg:`
                        // override; the expanded row classes are applied only when expanded.
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2.5 rounded-full px-0 font-ui text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                        // Expanded desktop rail only: stretch into the labelled pill row beside the name.
                        placement === 'rise' && !collapsed && 'lg:w-full lg:justify-start lg:px-2 lg:rounded-md',
                        open || onProfile
                            ? 'bg-ember-500/15 text-ember-400'
                            : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                    )}
                >
                    {isAuthenticated ? (
                        <Avatar
                            name={displayedName || 'You'}
                            size={28}
                            ring="ember"
                            // Active = a circular ring hugging the disc, concentric with the avatar's
                            // own ember halo (no rounded-rect border fighting the round icon).
                            className={cx(onProfile && 'ring-2 ring-ember-300 ring-offset-2 ring-offset-ink-900')}
                        />
                    ) : (
                        <Icon icon={CircleUserRound} size={20} />
                    )}
                    {placement === 'rise' && (
                        <span className={cx('hidden min-w-0 truncate', !collapsed && 'lg:inline')}>{visibleLabel}</span>
                    )}
                </button>
            </Tooltip>

            {mounted && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={t('sidebar.account.title')}
                    onKeyDown={handleMenuKeyDown}
                    className={cx(
                        'absolute z-50 flex max-h-[min(34rem,calc(100vh-2rem))] w-[min(16rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-xl border border-parchment-50/10 bg-ink-800 text-left shadow-xl transition-[opacity,transform] duration-200 ease-out',
                        menuPlacement,
                        entered ? 'translate-y-0 scale-100 opacity-100' : cx(enterFrom, 'scale-[.98] opacity-0'),
                    )}
                >
                    {/* Identity header. */}
                    <div className="flex items-center gap-2.5 border-b border-parchment-50/10 px-3 py-2.5">
                        {isAuthenticated ? (
                            <Avatar name={displayedName || 'You'} size={32} ring="ember" />
                        ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment-50/[.06] text-parchment-300">
                                <Icon icon={UserRound} size={18} />
                            </span>
                        )}
                        <div className="min-w-0">
                            <p className="truncate font-ui text-sm font-semibold text-parchment-50">
                                {isAuthenticated ? displayedName || t('sidebar.profile') : t('sidebar.account.signedOut')}
                            </p>
                            {isAuthenticated && user?.username && (
                                <p className="truncate font-mono text-[11px] text-parchment-400">@{user.username}</p>
                            )}
                        </div>
                    </div>

                    {/* Primary actions. */}
                    <div className="flex flex-col gap-0.5 p-1.5">
                        {isAuthenticated && (
                            <AccountMenuRow
                                icon={UserRound}
                                label={t('sidebar.yourProfile')}
                                title={displayedName || t('sidebar.yourProfile')}
                                current={onProfile}
                                onClick={() => navigate('profile')}
                            />
                        )}
                        <AccountMenuRow
                            icon={Info}
                            label={t('sidebar.docs')}
                            current={currentPage === 'docs'}
                            onClick={() => navigate('docs')}
                        />
                        <AccountMenuRow
                            icon={Code2}
                            label={t('sidebar.viewSource')}
                            title={t('sidebar.viewSourceAria')}
                            href="https://github.com/Andres77872/magic-worlds"
                            onClick={close}
                        />
                    </div>

                    {/* Admin (root only). */}
                    {isRoot && (
                        <div className="border-t border-parchment-50/10 p-1.5">
                            <div className="px-2 pb-1 pt-1">
                                <Eyebrow tone="muted">{t('sidebar.account.admin')}</Eyebrow>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <AccountMenuRow
                                    icon={Crown}
                                    label={t('sidebar.voiceAdmin')}
                                    current={currentPage === 'admin-voices'}
                                    onClick={() => navigate('admin-voices')}
                                />
                                <AccountMenuRow
                                    icon={Bot}
                                    label={t('sidebar.agentAdmin')}
                                    current={currentPage === 'admin-agents'}
                                    onClick={() => navigate('admin-agents')}
                                />
                                <AccountMenuRow
                                    icon={Ticket}
                                    label={t('sidebar.creditCodesAdmin')}
                                    current={currentPage === 'admin-credit-codes'}
                                    onClick={() => navigate('admin-credit-codes')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Language — inlined locale list (no nested popover). */}
                    <div className="border-t border-parchment-50/10 p-1.5">
                        <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-parchment-400">
                            <Icon icon={Globe} size={13} />
                            <Eyebrow tone="muted">{t('sidebar.account.language')}</Eyebrow>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {SUPPORTED_LANGUAGE_OPTIONS.map((opt) => {
                                const active = opt.code === language
                                return (
                                    <button
                                        key={opt.code}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={active}
                                        onClick={() => handleSelectLanguage(opt.code)}
                                        className={cx(
                                            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                            active ? 'bg-ember-500/10' : 'hover:bg-parchment-50/[.05]',
                                        )}
                                    >
                                        <span
                                            className={cx(
                                                'min-w-0 flex-1 truncate font-ui text-sm font-semibold',
                                                active ? 'text-ember-300' : 'text-parchment-50',
                                            )}
                                        >
                                            {opt.nativeLabel}
                                        </span>
                                        {active && <Icon icon={Check} size={16} className="shrink-0 text-ember-400" />}
                                    </button>
                                )
                            })}
                        </div>
                        {(isSyncing || syncError) && (
                            <div className="flex items-center gap-2 px-2.5 pb-0.5 pt-1.5 font-ui text-[11px] text-parchment-400">
                                {isSyncing ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-parchment-300" />
                                        <span>{t('common.saving')}</span>
                                    </>
                                ) : (
                                    <span className="text-blood-300">{t(syncError as string)}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Session action. */}
                    <div className="border-t border-parchment-50/10 p-1.5">
                        {isAuthenticated ? (
                            <AccountMenuRow
                                icon={LogOut}
                                danger
                                label={
                                    user?.username
                                        ? t('sidebar.logoutUser', { username: user.username })
                                        : t('sidebar.logout')
                                }
                                onClick={() => {
                                    close()
                                    setConfirmLogoutOpen(true)
                                }}
                            />
                        ) : (
                            <AccountMenuRow
                                icon={LogIn}
                                label={t('sidebar.login')}
                                onClick={() => {
                                    close()
                                    openLoginModal()
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            <LogoutConfirmDialog
                open={confirmLogoutOpen}
                username={user?.username}
                onCancel={() => setConfirmLogoutOpen(false)}
                onConfirm={confirmLogout}
            />
        </div>
    )
}
