/**
 * CodexEntryRow — one cloned snapshot in the codex panel: kind glyph, name,
 * enabled switch, and a hover cluster to open or remove the entry. Built on the
 * shared ReferenceRow so chat, lorebook, and novel codex rows stay in sync.
 */

import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { Icon, IconButton, IconTile, Switch } from '@/ui/primitives'
import { ReferenceRow } from '@/ui/components'
import type { CodexEntry } from '../../hooks/useCodex'
import { useOpenCodexEntry } from '../../hooks/useOpenCodexEntry'
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

    // Title opens a floating preview window; the hover pencil (and the window's
    // Edit action) open the editor drawer.
    const openCodexEntry = useOpenCodexEntry(onEdit)
    const openPreview = () => openCodexEntry(entry)

    return (
        <ReferenceRow
            testId="codex-entry-row"
            dimmed={!entry.enabled}
            leading={<IconTile icon={KIND_ICONS[entry.kind]} tone={arcane ? 'arcane' : 'ember'} size="sm" />}
            title={entry.label}
            description={entry.description || undefined}
            onTitleClick={openPreview}
            titleAriaLabel={t('novelEditor.codexRow.open', { label: entry.label })}
            hoverReveal={
                <>
                    <IconButton label={t('novelEditor.codexRow.edit', { label: entry.label })} size="sm" onClick={() => onEdit(entry)} disabled={disabled}>
                        <Icon icon={Pencil} size={14} />
                    </IconButton>
                    <IconButton label={t('novelEditor.codexRow.remove', { label: entry.label })} size="sm" tone="danger" onClick={() => onRemove(entry)} disabled={disabled}>
                        <Icon icon={Trash2} size={14} />
                    </IconButton>
                </>
            }
            trailing={
                <Switch
                    checked={entry.enabled}
                    onChange={() => onToggle(entry)}
                    size="sm"
                    disabled={disabled}
                    aria-label={entry.enabled ? t('novelEditor.codexRow.disable', { label: entry.label }) : t('novelEditor.codexRow.enable', { label: entry.label })}
                />
            }
        />
    )
}
