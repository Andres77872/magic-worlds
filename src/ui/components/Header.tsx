/**
 * App header — Reverie. Sticky, blurred over the dark canvas, with section nav.
 */
import { Code2, Flame, Globe, LogIn, LogOut, Sparkles, Swords, User, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { useNavigation, useAuth } from '../../app/hooks'
import { cx, Icon, IconButton } from '../primitives'

interface NavItem {
    page: PageType
    label: string
    icon: LucideIcon
    /** create pages require auth before navigating */
    gated?: boolean
}

const NAV_ITEMS: NavItem[] = [
    { page: 'landing', label: 'Home', icon: Sparkles },
    { page: 'character', label: 'Characters', icon: Users, gated: true },
    { page: 'world', label: 'Worlds', icon: Globe, gated: true },
    { page: 'adventure', label: 'Adventures', icon: Swords, gated: true },
]

export function Header() {
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()

    const go = (item: NavItem) => {
        if (item.gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(item.page)
    }

    return (
        <header className="sticky top-0 z-40 h-16 border-b border-parchment-50/[.08] bg-ink-900/70 backdrop-blur-md">
            <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
                {/* Brand */}
                <button
                    onClick={() => setPage('landing')}
                    aria-label="Go to home"
                    className="group flex shrink-0 items-center gap-2.5"
                >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400 transition-colors group-hover:text-ember-300">
                        <Icon icon={Flame} size={20} />
                    </span>
                    <span className="hidden font-display text-[22px] font-semibold leading-none text-parchment-50 sm:block">
                        Magic Worlds
                    </span>
                </button>

                {/* Section nav */}
                <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Primary">
                    {NAV_ITEMS.map((item) => {
                        const active = currentPage === item.page
                        return (
                            <button
                                key={item.page}
                                onClick={() => go(item)}
                                aria-current={active ? 'page' : undefined}
                                className={cx(
                                    'inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 font-ui text-[13px] font-semibold transition-colors lg:px-3',
                                    active
                                        ? 'bg-ember-500/15 text-ember-300'
                                        : 'text-parchment-200 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                                )}
                            >
                                <Icon icon={item.icon} size={16} className={active ? 'text-ember-400' : undefined} />
                                <span className="hidden lg:inline">{item.label}</span>
                            </button>
                        )
                    })}
                </nav>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                    {isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <span className="hidden items-center gap-2 rounded-full border border-parchment-50/[.08] bg-ink-700 px-3 py-1.5 text-[13px] text-parchment-200 md:inline-flex">
                                <Icon icon={User} size={15} className="text-ember-400" />
                                {user?.username}
                            </span>
                            <IconButton label="Logout" onClick={logout}>
                                <Icon icon={LogOut} size={18} />
                            </IconButton>
                        </div>
                    ) : (
                        <IconButton label="Login" onClick={openLoginModal}>
                            <Icon icon={LogIn} size={18} />
                        </IconButton>
                    )}

                    <a
                        href="https://github.com/Andres77872/magic-worlds"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View source code on GitHub"
                        title="View on GitHub"
                        className="hidden h-10 w-10 items-center justify-center rounded-md text-parchment-200 transition-colors hover:bg-parchment-50/[.05] hover:text-parchment-50 sm:inline-flex"
                    >
                        <Icon icon={Code2} size={18} />
                    </a>
                </div>
            </div>
        </header>
    )
}
