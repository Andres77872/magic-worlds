/**
 * MentionMenu — codex autocomplete opened by "@". Ember-toned: these are the
 * book's own people, places, and lore.
 */

import { useTranslation } from 'react-i18next'
import { Icon, cx } from '@/ui/primitives'
import type { EditorCodexEntry } from '../types'
import { KIND_ICONS } from '../../utils/codexUtils'

interface MentionMenuProps {
    items: EditorCodexEntry[]
    selectedIndex: number
    anchor: { left: number; top: number }
    onHover: (index: number) => void
    onSelect: (item: EditorCodexEntry) => void
}

export function MentionMenu({ items, selectedIndex, anchor, onHover, onSelect }: MentionMenuProps) {
    const { t } = useTranslation()
    return (
        <div
            role="listbox"
            aria-label={t('novelEditor.mention.label')}
            className="absolute z-30 w-[260px] overflow-hidden rounded-lg border border-ember-500/30 bg-ink-700 shadow-xl"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="mention-menu"
        >
            <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-1">
                {items.map((item, index) => (
                    <li key={item.id}>
                        <button
                            type="button"
                            role="option"
                            aria-selected={index === selectedIndex}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => onHover(index)}
                            onClick={() => onSelect(item)}
                            className={cx(
                                'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                                index === selectedIndex ? 'bg-ember-500/15' : 'hover:bg-ink-600/70',
                            )}
                            data-testid="mention-menu-item"
                        >
                            <span className="text-ember-400">
                                <Icon icon={KIND_ICONS[item.kind]} size={14} />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-ui text-sm text-parchment-100">{item.label}</span>
                        </button>
                    </li>
                ))}
                {items.length === 0 && (
                    <li className="px-2.5 py-2 font-ui text-xs text-parchment-500">{t('novelEditor.mention.noMatches')}</li>
                )}
            </ul>
        </div>
    )
}
