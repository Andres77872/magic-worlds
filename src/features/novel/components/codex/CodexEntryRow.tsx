/**
 * CodexEntryRow — one cloned snapshot in the codex panel: kind glyph, name,
 * a remove action, and the enabled switch. The action stays visible instead of
 * waiting for hover, because on touch a hover cluster simply does not exist.
 *
 * The NAME is the edit control. It used to open a floating preview card while a
 * hover-only pencil opened the drawer — two surfaces for editing one entry, one
 * of which did not exist on touch. Naming both the title and a pencil "Edit
 * Aria" would just move the redundancy into the accessibility tree, so the
 * pencil is gone. Built on the shared ReferenceRow so chat, lorebook, and novel
 * codex rows stay in sync.
 */

import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Icon, IconButton, IconTile, Switch } from '@/ui/primitives'
import { ReferenceRow } from '@/ui/components'
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
        <ReferenceRow
            testId="codex-entry-row"
            dimmed={!entry.enabled}
            leading={<IconTile icon={KIND_ICONS[entry.kind]} tone={arcane ? 'arcane' : 'ember'} size="sm" />}
            title={entry.label}
            description={entry.description || undefined}
            onTitleClick={() => onEdit(entry)}
            titleAriaLabel={t('novelEditor.codexRow.edit', { label: entry.label })}
            trailing={
                <>
                    <IconButton
                        label={t('novelEditor.codexRow.remove', { label: entry.label })}
                        size="sm"
                        tone="danger"
                        onClick={() => onRemove(entry)}
                        disabled={disabled}
                    >
                        <Icon icon={Trash2} size={14} />
                    </IconButton>
                    <Switch
                        checked={entry.enabled}
                        onChange={() => onToggle(entry)}
                        size="sm"
                        disabled={disabled}
                        aria-label={entry.enabled ? t('novelEditor.codexRow.disable', { label: entry.label }) : t('novelEditor.codexRow.enable', { label: entry.label })}
                    />
                </>
            }
        />
    )
}
