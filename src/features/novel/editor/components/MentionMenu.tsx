/**
 * MentionMenu — codex autocomplete opened by "@". Ember-toned: these are the
 * book's own people, places, and lore.
 */

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Icon, cx } from '@/ui/primitives'
import type { EditorCodexEntry } from '../types'
import { KIND_ICONS } from '../../utils/codexUtils'
import { ReferenceEntrySummary } from './ReferenceEntrySummary'

interface MentionMenuProps {
    menuId?: string
    items: EditorCodexEntry[]
    selectedIndex: number
    anchor: { left: number; top: number }
    onHover: (index: number) => void
    onSelect: (item: EditorCodexEntry) => void
}

export function MentionMenu({ items, selectedIndex, anchor, onHover, onSelect, menuId }: MentionMenuProps) {
    const { t } = useTranslation()
    const listRef = useRef<HTMLUListElement>(null)
    useEffect(() => { listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }) }, [selectedIndex])
    return (
        <div
            id={menuId}
            role="listbox"
            aria-label={t('novelEditor.mention.label')}
            className="absolute z-30 w-72 max-w-full overflow-hidden rounded-lg border border-ember-500/30 bg-ink-700 shadow-xl"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="mention-menu"
        >
            <p className="px-3 py-2 font-ui text-caption text-parchment-300">{t('novelEditor.references.searchHelp')}</p>
            <ul ref={listRef} className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-1">
                {items.map((item, index) => (
                    <li key={item.id}>
                        <Button
                            variant="ghost"
                            type="button"
                            id={menuId ? `${menuId}-option-${index}` : undefined}
                            role="option"
                            aria-selected={index === selectedIndex}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => onHover(index)}
                            onClick={() => onSelect(item)}
                            className={cx(
                                'h-auto w-full items-start justify-start gap-2 whitespace-normal px-2.5 py-2 text-left',
                                index === selectedIndex ? 'bg-ember-500/15' : 'hover:bg-ink-600/70',
                            )}
                            data-testid="mention-menu-item"
                        >
                            <span className="text-ember-400">
                                <Icon icon={KIND_ICONS[item.kind]} size={14} />
                            </span>
                            <ReferenceEntrySummary entry={item} preview />
                        </Button>
                    </li>
                ))}
                {items.length === 0 && (
                    <li className="px-2.5 py-2 font-ui text-xs text-parchment-300">{t('novelEditor.mention.noMatches')}</li>
                )}
            </ul>
        </div>
    )
}
