/**
 * App sidebar — Reverie. A slim, full-height icon rail (replaces the top
 * header): brand at the top, primary nav in the middle, source + account at
 * the bottom. Each control is an icon button with a tooltip/aria-label.
 */
import { useState } from 'react'
import { BookOpen, Code2, Compass, Flame, Globe, Images, ListChecks, LogIn, LogOut, Server, Swords, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { useNavigation, useAuth, useBackgroundTasks, useApiStatus } from '../../app/hooks'
import type { ApiStatus } from '../../app/hooks'
import { Avatar, Icon, IconButton, cx } from '../primitives'
import { LogoutConfirmDialog } from './LogoutConfirmDialog'

interface RailItem {
    page: PageType
    label: string
    icon: LucideIcon
    /** create pages require auth before navigating */
    gated?: boolean
}

// The three library items open the full galleries; the creators stay reachable
// from the dashboard AccessMenu and each gallery's "New …" button.
const NAV_ITEMS: RailItem[] = [
    { page: 'landing', label: 'Explore', icon: Compass },
    { page: 'gallery-characters', label: 'Characters', icon: Users, gated: true },
    { page: 'gallery-worlds', label: 'Worlds', icon: Globe, gated: true },
    { page: 'gallery-adventures', label: 'Adventures', icon: Swords, gated: true },
    { page: 'gallery-lorebooks', label: 'Lorebooks', icon: BookOpen, gated: true },
    { page: 'gallery-media', label: 'Media', icon: Images, gated: true },
]

const API_STATUS_VIEW: Record<ApiStatus, { label: string; className: string; dotClassName: string }> = {
    checking: {
        label: 'Checking API status',
        className: 'text-parchment-300 bg-parchment-50/[.04]',
        dotClassName: 'bg-parchment-300 animate-pulse',
    },
    online: {
        label: 'API online',
        className: 'text-verdant-500 bg-verdant-500/10',
        dotClassName: 'bg-verdant-500',
    },
    offline: {
        label: 'API offline',
        className: 'text-blood-500 bg-blood-500/10',
        dotClassName: 'bg-blood-500',
    },
}

function ApiStatusIndicator({ status }: { status: ApiStatus }) {
    const view = API_STATUS_VIEW[status]
    return (
        <div
            role="status"
            aria-label={view.label}
            title={view.label}
            className={cx(
                'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                view.className,
            )}
        >
            <Icon icon={Server} size={18} />
            <span
                aria-hidden="true"
                className={cx(
                    'absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-ink-900',
                    view.dotClassName,
                )}
            />
        </div>
    )
}

export function Sidebar() {
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()
    const { activeCount, openDrawer } = useBackgroundTasks()
    const { status: apiStatus } = useApiStatus()
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)

    const go = (item: RailItem) => {
        if (item.gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(item.page)
    }

    const confirmLogout = () => {
        setConfirmLogoutOpen(false)
        logout()
    }

    return (
        <aside className="sticky top-0 z-40 flex h-screen w-16 shrink-0 flex-col items-center gap-2 border-r border-parchment-50/[.08] bg-ink-900/80 py-4 backdrop-blur-md">
            <button
                onClick={() => setPage('landing')}
                aria-label="Magic Worlds — home"
                title="Magic Worlds"
                className="group inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400 transition-colors hover:text-ember-300"
            >
                <Icon icon={Flame} size={20} />
            </button>

            <nav className="mt-2 flex flex-col items-center gap-1.5" aria-label="Primary">
                {NAV_ITEMS.map((item) => {
                    const active = currentPage === item.page
                    return (
                        <IconButton
                            key={item.page}
                            label={item.label}
                            tone={active ? 'active' : 'default'}
                            onClick={() => go(item)}
                            aria-current={active ? 'page' : undefined}
                        >
                            <Icon icon={item.icon} size={20} />
                        </IconButton>
                    )
                })}
            </nav>

            <div className="mt-auto flex flex-col items-center gap-2">
                <ApiStatusIndicator status={apiStatus} />

                {isAuthenticated && (
                    <div className="relative">
                        <IconButton label={activeCount > 0 ? `${activeCount} active task${activeCount === 1 ? '' : 's'}` : 'Tasks'} onClick={openDrawer}>
                            <Icon icon={ListChecks} size={19} />
                        </IconButton>
                        {activeCount > 0 && (
                            <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-arcane-500 px-1 font-ui text-[10px] font-bold leading-none text-ink-900 ring-2 ring-ink-900">
                                {activeCount > 9 ? '9+' : activeCount}
                            </span>
                        )}
                    </div>
                )}

                <a
                    href="https://github.com/Andres77872/magic-worlds"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View source on GitHub"
                    title="View on GitHub"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50"
                >
                    <Icon icon={Code2} size={18} />
                </a>

                {isAuthenticated ? (
                    <>
                        <button
                            onClick={() => setPage('profile')}
                            aria-label="Your profile"
                            aria-current={currentPage === 'profile' ? 'page' : undefined}
                            title={user?.username ?? 'Your profile'}
                            className={cx(
                                'mt-0.5 inline-flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                currentPage === 'profile' &&
                                    'ring-2 ring-ember-400 ring-offset-2 ring-offset-ink-900',
                            )}
                        >
                            <Avatar name={user?.username || 'You'} size={36} ring="ember" />
                        </button>
                        <IconButton
                            label={user?.username ? `Log out ${user.username}` : 'Log out'}
                            tone="danger"
                            onClick={() => setConfirmLogoutOpen(true)}
                        >
                            <Icon icon={LogOut} size={18} />
                        </IconButton>
                    </>
                ) : (
                    <IconButton label="Log in" tone="active" onClick={openLoginModal}>
                        <Icon icon={LogIn} size={18} />
                    </IconButton>
                )}
            </div>

            <LogoutConfirmDialog
                open={confirmLogoutOpen}
                username={user?.username}
                onCancel={() => setConfirmLogoutOpen(false)}
                onConfirm={confirmLogout}
            />
        </aside>
    )
}
