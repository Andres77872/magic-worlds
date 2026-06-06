/**
 * App sidebar — Reverie. A slim, full-height icon rail (replaces the top
 * header): brand at the top, primary nav in the middle, source + account at
 * the bottom. Each control is an icon button with a tooltip/aria-label.
 */
import { Code2, Compass, Flame, Globe, LogIn, LogOut, Swords, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PageType } from '../../shared'
import { useNavigation, useAuth } from '../../app/hooks'
import { Avatar, Icon, IconButton } from '../primitives'

interface RailItem {
    page: PageType
    label: string
    icon: LucideIcon
    /** create pages require auth before navigating */
    gated?: boolean
}

const NAV_ITEMS: RailItem[] = [
    { page: 'landing', label: 'Explore', icon: Compass },
    { page: 'character', label: 'Characters', icon: Users, gated: true },
    { page: 'world', label: 'Worlds', icon: Globe, gated: true },
    { page: 'adventure', label: 'Adventures', icon: Swords, gated: true },
]

export function Sidebar() {
    const { currentPage, setPage } = useNavigation()
    const { isAuthenticated, user, logout, openLoginModal } = useAuth()

    const go = (item: RailItem) => {
        if (item.gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(item.page)
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
                        <span title={user?.username ?? 'Account'} className="mt-0.5">
                            <Avatar name={user?.username || 'You'} size={36} ring="ember" />
                        </span>
                        <IconButton
                            label={user?.username ? `Log out ${user.username}` : 'Log out'}
                            tone="danger"
                            onClick={logout}
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
        </aside>
    )
}
