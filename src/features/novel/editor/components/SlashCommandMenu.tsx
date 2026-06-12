/**
 * SlashCommandMenu — the caret-anchored AI command list opened by "/".
 * Arcane-toned: this menu talks to the muse, not the document.
 */

import { Feather, MessageSquareQuote, ScrollText, Sparkles } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'
import type { SlashItem } from '../extensions/slashCommand'

const ITEM_ICONS: Record<string, typeof Sparkles> = {
    continue: Feather,
    describe: ScrollText,
    critique: MessageSquareQuote,
    custom: Sparkles,
}

interface SlashCommandMenuProps {
    items: SlashItem[]
    selectedIndex: number
    anchor: { left: number; top: number }
    onHover: (index: number) => void
    onSelect: (item: SlashItem) => void
}

export function SlashCommandMenu({ items, selectedIndex, anchor, onHover, onSelect }: SlashCommandMenuProps) {
    if (items.length === 0) return null
    return (
        <div
            role="listbox"
            aria-label="AI commands"
            className="absolute z-30 w-[320px] overflow-hidden rounded-lg border border-arcane-500/30 bg-ink-700 shadow-xl"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="slash-command-menu"
        >
            <p className="m-0 border-b border-parchment-50/[.06] px-3 py-1.5 font-ui text-[11px] uppercase tracking-[0.14em] text-arcane-300">
                Ask the muse
            </p>
            <ul className="m-0 flex list-none flex-col p-1">
                {items.map((item, index) => (
                    <li key={item.key}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={index === selectedIndex}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => onHover(index)}
                            onClick={() => onSelect(item)}
                            className={cx(
                                'flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                                index === selectedIndex ? 'bg-arcane-500/15' : 'hover:bg-ink-600/70',
                            )}
                            data-testid="slash-command-item"
                        >
                            <span className="mt-0.5 text-arcane-400">
                                <Icon icon={ITEM_ICONS[item.key] ?? Sparkles} size={15} />
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
