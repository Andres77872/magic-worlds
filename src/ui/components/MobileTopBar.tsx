/**
 * Mobile top bar — the sticky chrome shown below the `lg` breakpoint where the
 * docked rail is hidden. Layout: hamburger (opens the SidebarNavDrawer) · brand
 * (home) · account menu. Keeps the page width free for content (no permanent
 * rail) while still surfacing navigation, identity and the background-task count.
 */
import { useTranslation } from 'react-i18next'
import { Flame, Menu } from 'lucide-react'
import { useBackgroundTasks, useNavigation } from '../../app/hooks'
import { Icon, IconButton } from '../primitives'
import { SidebarAccountMenu } from './SidebarAccountMenu'

function scrollMainToTop() {
    document.querySelector<HTMLElement>('[data-app-main]')?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

interface MobileTopBarProps {
    onOpenNav: () => void
}

export function MobileTopBar({ onOpenNav }: MobileTopBarProps) {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { activeCount } = useBackgroundTasks()

    return (
        <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-parchment-50/[.08] bg-ink-900/80 px-3 backdrop-blur-md lg:hidden">
            <div className="relative">
                <IconButton label={t('sidebar.openNav')} onClick={onOpenNav}>
                    <Menu size={20} strokeWidth={1.75} />
                </IconButton>
                {activeCount > 0 && (
                    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-arcane-500 px-1 font-ui text-[10px] font-bold leading-none text-ink-900 ring-2 ring-ink-900">
                        {activeCount > 9 ? '9+' : activeCount}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={() => {
                    setPage('landing')
                    window.requestAnimationFrame(scrollMainToTop)
                }}
                aria-label={t('sidebar.homeButton')}
                title="Magic Worlds"
                className="inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 font-ui text-sm font-semibold text-ember-400 transition-colors hover:text-ember-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
            >
                <Icon icon={Flame} size={20} />
                <span className="truncate">Magic Worlds</span>
            </button>

            <SidebarAccountMenu placement="drop" />
        </div>
    )
}
