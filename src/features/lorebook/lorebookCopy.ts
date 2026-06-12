/**
 * Human-readable copy for lorebook enum values — entry types, secondary-key
 * logic, and prompt insertion positions. Single source for the editor selects
 * and the entry table labels.
 *
 * Note: the backend stores but does not yet evaluate selective logic /
 * secondary keys during activation; revisit these descriptions when
 * evaluation lands.
 */
import type { LorebookEntryType, LorebookInsertionPosition, LorebookSelectiveLogic } from '@/shared'
import type { SelectOption } from '@/ui/primitives'

const ENTRY_TYPE_LABELS: Record<LorebookEntryType, string> = {
    character: 'Character',
    world: 'World',
    faction: 'Faction',
    place: 'Place',
    item: 'Item',
    rule: 'Rule',
    secret: 'Secret',
    quest: 'Quest',
    state: 'State',
    relationship: 'Relationship',
    other: 'Other',
}

export const ENTRY_TYPE_OPTIONS: SelectOption[] = (
    Object.entries(ENTRY_TYPE_LABELS) as Array<[LorebookEntryType, string]>
).map(([value, label]) => ({ value, label }))

export function entryTypeLabel(type: LorebookEntryType): string {
    return ENTRY_TYPE_LABELS[type] ?? type
}

export const SELECTIVE_LOGIC_OPTIONS: Array<SelectOption & { value: LorebookSelectiveLogic }> = [
    {
        value: 'any',
        label: 'Any secondary key',
        description: 'Activates on a primary key; any matching secondary key is enough when some are set.',
    },
    {
        value: 'all',
        label: 'All secondary keys',
        description: 'Activates on a primary key only when every secondary key also matches.',
    },
    {
        value: 'and_any',
        label: 'Primary + any secondary',
        description: 'Requires a primary key plus at least one secondary key.',
    },
    {
        value: 'and_all',
        label: 'Primary + all secondary',
        description: 'Requires a primary key plus every secondary key.',
    },
    {
        value: 'not_any',
        label: 'Block if any secondary',
        description: 'Primary match is suppressed when any secondary key appears.',
    },
    {
        value: 'not_all',
        label: 'Block if all secondary',
        description: 'Primary match is suppressed only when every secondary key appears.',
    },
]

export const INSERTION_POSITION_OPTIONS: Array<SelectOption & { value: LorebookInsertionPosition }> = [
    {
        value: 'before_context',
        label: 'Before context',
        description: 'Added above the scene context; frames everything that follows.',
    },
    {
        value: 'after_context',
        label: 'After context',
        description: 'Added below the context, closer to the latest messages, for stronger pull.',
    },
    {
        value: 'author_note',
        label: "Author's note",
        description: "Injected at the author's-note slot for strong, recent influence.",
    },
    {
        value: 'system',
        label: 'System prompt',
        description: 'Merged into the system prompt. Highest authority; use sparingly.',
    },
]
