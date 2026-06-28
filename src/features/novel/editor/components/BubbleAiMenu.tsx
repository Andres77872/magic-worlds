/**
 * BubbleAiMenu — the "Ask the muse" dropdown opened from the selection toolbar.
 * Collapses the AI selection commands (rewrite/expand/condense/describe) into a
 * single labelled, arcane-toned menu instead of four cramped buttons.
 *
 * Mouse-driven by design: every control uses onMouseDown preventDefault so the
 * editor never blurs and the live selection (and the BubbleMenu hosting it) stay
 * put. Closes on Escape or an outside click.
 */

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import type { StoryGenerationCommand } from '@/shared'
import { Icon, cx } from '@/ui/primitives'

export interface BubbleAiItem {
    command: StoryGenerationCommand
    label: string
    description: string
    icon: LucideIcon
}

interface BubbleAiMenuProps {
    items: BubbleAiItem[]
    onSelect: (command: StoryGenerationCommand) => void
    onClose: () => void
}

export function BubbleAiMenu({ items, onSelect, onClose }: BubbleAiMenuProps) {
    const { t } = useTranslation()
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handlePointer = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) onClose()
        }
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
            }
        }
        // Capture so the editor's own handlers don't swallow the outside click first.
        document.addEventListener('mousedown', handlePointer, true)
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('mousedown', handlePointer, true)
            document.removeEventListener('keydown', handleKey)
        }
    }, [onClose])

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label={t('novelEditor.bubbleMenu.askMuse')}
            className="absolute right-0 top-[calc(100%+6px)] z-40 w-[280px] overflow-hidden rounded-lg border border-arcane-500/30 bg-ink-700 shadow-xl"
            data-testid="bubble-ai-menu"
        >
            <p className="m-0 border-b border-parchment-50/[.06] px-3 py-1.5 font-ui text-[11px] uppercase tracking-[0.14em] text-arcane-300">
                {t('novelEditor.bubbleMenu.askMuse')}
            </p>
            <ul className="m-0 flex list-none flex-col p-1">
                {items.map((item) => (
                    <li key={item.command}>
                        <button
                            type="button"
                            role="menuitem"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelect(item.command)}
                            className={cx(
                                'flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                                'hover:bg-arcane-500/15',
                            )}
                            data-testid="bubble-ai-item"
                        >
                            <span className="mt-0.5 text-arcane-400">
                                <Icon icon={item.icon} size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{item.label}</span>
                                <span className="block truncate font-ui text-xs text-parchment-400">{item.description}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
