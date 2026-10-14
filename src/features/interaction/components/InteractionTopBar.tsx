import { useTranslation } from 'react-i18next'
import { Menu, ScrollText } from 'lucide-react'
import { cx, IconButton } from '@/ui/primitives'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'
import type { PlayMode } from '@/shared/modes'
import { AdventureCastVoiceStrip } from './voice/AdventureCastVoiceStrip'
import { ChatVoiceIndicator } from './voice/ChatVoiceIndicator'

interface InteractionTopBarProps {
    title: string
    mode: PlayMode
    onToggleLeft: () => void
    leftOpen: boolean
    /** Right (log) toggle — adventure only. Omit for character chat. */
    onToggleRight?: () => void
    rightOpen?: boolean
    dockAt?: 'lg' | 'xl'
}

/**
 * Slim mobile top bar (`lg:hidden`) for the interaction / character-chat screens.
 * Holds the drawer toggles + the session title, so the side panels no longer need
 * floating buttons that overlap their own headers. Desktop keeps the static
 * multi-column layout with no top bar (the back button lives in the left panel).
 *
 * Both modes add the D36 voice strip under the bar (R1-FE-04, 05 §7.8, AC-C6),
 * hidden where the side panels dock: `ChatVoiceIndicator` for character chats,
 * `AdventureCastVoiceStrip` (the side panel's cast block) for adventures. Both
 * render nothing when there is no voice change to show, so those sessions get just the bar.
 */
export function InteractionTopBar({
    title,
    mode,
    onToggleLeft,
    leftOpen,
    onToggleRight,
    rightOpen = false,
    dockAt = 'lg',
}: InteractionTopBarProps) {
    const { t } = useTranslation()
    const header = (
        <header className={cx('sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-parchment-50/[.08] bg-ink-900/80 px-2 backdrop-blur-md', dockAt === 'xl' ? 'xl:hidden' : 'lg:hidden')}>
            <IconButton
                label={mode === 'adventure' ? t('interaction.topBar.adventureDetails') : t('interaction.topBar.characterDetails')}
                size="sm"
                tone={leftOpen ? 'active' : 'default'}
                onClick={onToggleLeft}
                aria-expanded={leftOpen}
            >
                <Menu size={18} strokeWidth={1.75} />
            </IconButton>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                <span className="min-w-0 truncate font-display text-body font-semibold text-parchment-50">{title}</span>
                <ModeBadge mode={mode} compact className="shrink-0" />
            </div>

            {onToggleRight ? (
                <IconButton
                    label={t('interaction.topBar.adventureLog')}
                    size="sm"
                    tone={rightOpen ? 'active' : 'default'}
                    onClick={onToggleRight}
                    aria-expanded={rightOpen}
                >
                    <ScrollText size={18} strokeWidth={1.75} />
                </IconButton>
            ) : (
                <span className="h-8 w-8 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11" aria-hidden />
            )}
        </header>
    )
    const docked = dockAt === 'xl' ? 'xl:hidden' : 'lg:hidden'
    return (
        <>
            {header}
            {mode === 'chat'
                ? <ChatVoiceIndicator variant="bar" className={docked} />
                : <AdventureCastVoiceStrip className={docked} />}
        </>
    )
}
