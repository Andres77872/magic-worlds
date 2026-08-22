/**
 * BubbleAiMenu — the AI menu on the selection toolbar.
 *
 * Presentational on purpose. The trigger, the open flag and the dismissal
 * handlers stay in EditorBubbleMenu, which wraps both in one element: a
 * component that owned its own outside-click listener would race the toolbar's,
 * and the loser closes the menu on the very click that opened it. That is the
 * bug the previous version of this file had.
 *
 * Its first entry opens the beat composer on the selection, so the writer can
 * say what to do in their own words instead of picking from canned verbs.
 */

import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, Minimize2, PenLine, ScrollText, Wand2, type LucideIcon } from 'lucide-react'
import type { StoryGenerationCommand } from '@/shared'
import { Icon } from '@/ui/primitives'

interface BubbleAiCommand {
    command: StoryGenerationCommand
    label: string
    icon: LucideIcon
}

interface BubbleAiMenuProps {
    /** Opens the beat composer with the selection as its target. */
    onBeat: () => void
    onSelectCommand: (command: StoryGenerationCommand) => void
}

/** The canned verbs, in the order a rewrite pass usually wants them. */
function bubbleAiCommands(t: (key: string) => string): BubbleAiCommand[] {
    return [
        { command: 'rewrite', label: t('novelEditor.bubbleMenu.rewrite'), icon: PenLine },
        { command: 'expand', label: t('novelEditor.bubbleMenu.expand'), icon: Maximize2 },
        { command: 'condense', label: t('novelEditor.bubbleMenu.condense'), icon: Minimize2 },
        { command: 'describe', label: t('novelEditor.bubbleMenu.describe'), icon: ScrollText },
    ]
}

/** Mousedown never reaches the editor, so the live selection survives the click. */
function preventBlur(event: MouseEvent) {
    event.preventDefault()
}

function AiMenuItem({ label, icon, onSelect }: { label: string; icon: LucideIcon; onSelect: () => void }) {
    return (
        <button
            type="button"
            role="menuitem"
            onMouseDown={preventBlur}
            onClick={onSelect}
            className="flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-xs px-2 text-left font-ui text-label text-parchment-100 transition-colors hover:bg-parchment-50/[.06]"
            data-testid="bubble-ai-item"
        >
            <span className="shrink-0 text-arcane-400">
                <Icon icon={icon} size={14} />
            </span>
            {label}
        </button>
    )
}

export function BubbleAiMenu({ onBeat, onSelectCommand }: BubbleAiMenuProps) {
    const { t } = useTranslation()
    return (
        <div
            role="menu"
            aria-label={t('novelEditor.bubbleMenu.aiMenu')}
            className="absolute right-0 top-[calc(100%+6px)] z-[100] w-[240px] overflow-hidden rounded-md border border-parchment-50/10 bg-ink-700 p-1 shadow-lg"
            data-testid="bubble-ai-menu"
        >
            <AiMenuItem label={t('novelEditor.bubbleMenu.beat')} icon={Wand2} onSelect={onBeat} />
            <span className="my-1 block h-px bg-parchment-50/10" aria-hidden="true" />
            {bubbleAiCommands(t).map((item) => (
                <AiMenuItem key={item.command} label={item.label} icon={item.icon} onSelect={() => onSelectCommand(item.command)} />
            ))}
        </div>
    )
}
