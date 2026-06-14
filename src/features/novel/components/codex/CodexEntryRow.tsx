/**
 * CodexEntryRow — one cloned snapshot in the codex panel: kind glyph, name,
 * enabled switch, and a hover cluster to open or remove the entry.
 */

import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { Icon, IconButton, IconTile, Switch, cx } from '@/ui/primitives'
import type { CodexEntry } from '../../hooks/useCodex'
import { KIND_ICONS } from '../../utils/codexUtils'

interface CodexEntryRowProps {
    entry: CodexEntry
    disabled?: boolean
    onToggle: (entry: CodexEntry) => void
    onEdit: (entry: CodexEntry) => void
    onRemove: (entry: CodexEntry) => void
}

export function CodexEntryRow({ entry, disabled, onToggle, onEdit, onRemove }: CodexEntryRowProps) {
    const { t } = useTranslation()
    const arcane = entry.kind === 'world' || entry.kind === 'lorebook' || entry.kind === 'lorebook_entry'
    return (
        <div
            className={cx(
                'group flex items-center gap-2.5 rounded-md border border-parchment-50/10 bg-ink-700/60 px-2.5 py-2 transition-colors hover:border-parchment-50/20',
                !entry.enabled && 'opacity-50',
            )}
            data-testid="codex-entry-row"
        >
            <IconTile icon={KIND_ICONS[entry.kind]} tone={arcane ? 'arcane' : 'ember'} size="sm" />
            <button
                type="button"
                onClick={() => onEdit(entry)}
                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                aria-label={t('novelEditor.codexRow.open', { label: entry.label })}
            >
                <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{entry.label}</span>
                {entry.description && (
                    <span className="block truncate font-ui text-xs text-parchment-400">{entry.description}</span>
                )}
            </button>
            <div className="flex shrink-0 items-center gap-1">
                <span className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton label={t('novelEditor.codexRow.edit', { label: entry.label })} size="sm" onClick={() => onEdit(entry)} disabled={disabled}>
                        <Icon icon={Pencil} size={14} />
                    </IconButton>
                    <IconButton label={t('novelEditor.codexRow.remove', { label: entry.label })} size="sm" tone="danger" onClick={() => onRemove(entry)} disabled={disabled}>
                        <Icon icon={Trash2} size={14} />
                    </IconButton>
                </span>
                <Switch
                    checked={entry.enabled}
                    onChange={() => onToggle(entry)}
                    size="sm"
                    disabled={disabled}
                    aria-label={entry.enabled ? t('novelEditor.codexRow.disable', { label: entry.label }) : t('novelEditor.codexRow.enable', { label: entry.label })}
                />
            </div>
        </div>
    )
}
