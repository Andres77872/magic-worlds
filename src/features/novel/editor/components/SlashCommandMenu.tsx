/**
 * SlashCommandMenu — the caret-anchored "/" menu. Two sections: Write (the AI
 * commands, first, because that is what this editor is for) and Insert (block
 * structure). selectedIndex stays a flat index over the combined list; section
 * headers are interleaved at render time.
 *
 * One accent only. The old menu tinted the whole selected row ember or arcane
 * depending on the section, and gave every item a two-line label + description
 * that told you nothing "Quote" didn't. Rows are single-line and 32px; the
 * selection is a neutral tint plus a 2px ember bar, and AI items are marked by
 * an arcane glyph rather than by recolouring the row.
 */

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Asterisk,
    CornerDownRight,
    Eye,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    MessageSquareQuote,
    Quote,
    Sparkles,
    type LucideIcon,
} from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'
import type { SlashItem, SlashSection } from '../extensions/slashCommand'

const ITEM_ICONS: Record<string, LucideIcon> = {
    beat: Sparkles,
    free: Sparkles,
    continue: CornerDownRight,
    describe: Eye,
    critique: MessageSquareQuote,
    heading: Heading1,
    subheading: Heading2,
    bulletList: List,
    orderedList: ListOrdered,
    quote: Quote,
    sceneBreak: Asterisk,
}

const SECTION_HEADERS: Record<SlashSection, string> = {
    write: 'novelEditor.slash.writeHeader',
    insert: 'novelEditor.slash.insertHeader',
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
            className="absolute z-[100] w-[300px] max-w-[calc(100%-16px)] overflow-hidden rounded-md border border-parchment-50/[.12] bg-ink-700 p-1 shadow-lg"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="slash-command-menu"
        >
            <ul className="m-0 flex list-none flex-col p-0">
                {items.map((item, index) => {
                    const showHeader = index === 0 || items[index - 1].section !== item.section
                    const isAi = item.section === 'write'
                    return (
                        <Fragment key={item.key}>
                            {showHeader && (
                                <li
                                    aria-hidden="true"
                                    className="m-0 px-2.5 pb-1 pt-1.5 font-ui text-micro uppercase tracking-[0.14em] text-parchment-400"
                                >
                                    {t(SECTION_HEADERS[item.section])}
                                </li>
                            )}
                            <li>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={index === selectedIndex}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseEnter={() => onHover(index)}
                                    onClick={() => onSelect(item)}
                                    className={cx(
                                        'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-xs border-l-2 px-2 text-left transition-colors',
                                        index === selectedIndex
                                            ? 'border-ember-500 bg-parchment-50/[.07]'
                                            : 'border-transparent hover:bg-parchment-50/[.05]',
                                    )}
                                    data-testid="slash-command-item"
                                >
                                    <span className={isAi ? 'text-arcane-400' : 'text-parchment-300'}>
                                        <Icon icon={ITEM_ICONS[item.key] ?? Sparkles} size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-ui text-label text-parchment-100">
                                        {item.label}
                                    </span>
                                    {item.hint && (
                                        <span className="shrink-0 font-mono text-micro text-parchment-400">{item.hint}</span>
                                    )}
                                </button>
                            </li>
                        </Fragment>
                    )
                })}
            </ul>
        </div>
    )
}
