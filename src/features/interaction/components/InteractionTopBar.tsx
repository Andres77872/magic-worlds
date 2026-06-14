import { useTranslation } from 'react-i18next'
import { Menu, ScrollText } from 'lucide-react'
import { IconButton } from '../../../ui/primitives'
import { ModeBadge } from '../../../ui/components/common/ModeBadge'
import type { PlayMode } from '@/shared/modes'

interface InteractionTopBarProps {
    title: string
    mode: PlayMode
    onToggleLeft: () => void
    leftOpen: boolean
    /** Right (log) toggle — adventure only. Omit for character chat. */
    onToggleRight?: () => void
    rightOpen?: boolean
}

/**
 * Slim mobile top bar (`lg:hidden`) for the interaction / character-chat screens.
 * Holds the drawer toggles + the session title, so the side panels no longer need
 * floating buttons that overlap their own headers. Desktop keeps the static
 * multi-column layout with no top bar (the back button lives in the left panel).
 */
export function InteractionTopBar({
    title,
    mode,
    onToggleLeft,
    leftOpen,
    onToggleRight,
    rightOpen = false,
}: InteractionTopBarProps) {
    const { t } = useTranslation()
    return (
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-parchment-50/[.08] bg-ink-900/80 px-2 backdrop-blur-md lg:hidden">
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
                <span className="min-w-0 truncate font-display text-[15px] font-semibold text-parchment-50">{title}</span>
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
                <span className="h-8 w-8 shrink-0" aria-hidden />
            )}
        </header>
    )
}
