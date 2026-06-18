/**
 * SlashCommandMenu — the caret-anchored "/" menu. Two sections: structural
 * Blocks (ember) and the AI commands (arcane). selectedIndex stays a flat index
 * over the combined list; section headers are interleaved at render time.
 */

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Asterisk,
    Feather,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    MessageSquareQuote,
    Quote,
    ScrollText,
    Sparkles,
    type LucideIcon,
} from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'
import type { SlashItem, SlashSection } from '../extensions/slashCommand'

const ITEM_ICONS: Record<string, LucideIcon> = {
    // AI
    continue: Feather,
    describe: ScrollText,
    critique: MessageSquareQuote,
    custom: Sparkles,
    // Blocks
    heading: Heading1,
    subheading: Heading2,
    bulletList: List,
    orderedList: ListOrdered,
    quote: Quote,
    sceneBreak: Asterisk,
}

const SECTION_HEADERS: Record<SlashSection, string> = {
    block: 'novelEditor.slash.blocksHeader',
    ai: 'novelEditor.slash.askMuse',
}

interface SlashCommandMenuProps {
    items: SlashItem[]
    selectedIndex: number
    anchor: { left: number; top: number }
    onHover: (index: number) => void
    onSelect: (item: SlashItem) => void
}

export function SlashCommandMenu({ items, selectedIndex, anchor, onHover, onSelect }: SlashCommandMenuProps) {
    const { t } = useTranslation()
    if (items.length === 0) return null
    return (
        <div
            role="listbox"
            aria-label={t('novelEditor.slash.label')}
            className="absolute z-30 w-[320px] overflow-hidden rounded-lg border border-arcane-500/30 bg-ink-700 shadow-xl"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="slash-command-menu"
        >
            <ul className="m-0 flex list-none flex-col p-1">
                {items.map((item, index) => {
                    const showHeader = index === 0 || items[index - 1].section !== item.section
                    const arcane = item.section === 'ai'
                    return (
                        <Fragment key={item.key}>
                            {showHeader && (
                                <li
                                    aria-hidden="true"
                                    className={cx(
                                        'm-0 px-2.5 pb-1 pt-1.5 font-ui text-[11px] uppercase tracking-[0.14em]',
                                        arcane ? 'text-arcane-300' : 'text-ember-300',
                                    )}
                                >
                                    {t(SECTION_HEADERS[item.section])}
                                </li>
                            )}
                            <li>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={index === selectedIndex}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => onHover(index)}
                                    onClick={() => onSelect(item)}
                                    className={cx(
                                        'flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                                        index === selectedIndex ? (arcane ? 'bg-arcane-500/15' : 'bg-ember-500/15') : 'hover:bg-ink-600/70',
                                    )}
                                    data-testid="slash-command-item"
                                >
                                    <span className={cx('mt-0.5', arcane ? 'text-arcane-400' : 'text-ember-400')}>
                                        <Icon icon={ITEM_ICONS[item.key] ?? Sparkles} size={15} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{item.label}</span>
                                        <span className="block truncate font-ui text-xs text-parchment-400">{item.description}</span>
                                    </span>
                                </button>
                            </li>
                        </Fragment>
                    )
                })}
            </ul>
        </div>
    )
}
