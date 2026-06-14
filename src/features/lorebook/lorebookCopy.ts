/**
 * Human-readable copy for lorebook enum values — entry types, secondary-key
 * logic, and prompt insertion positions. Single source for the editor selects
 * and the entry table labels.
 *
 * Each option carries a `labelKey` (an i18n key under `lorebookStudio.options.*`);
 * consumers resolve the visible label via `t(option.labelKey)`. `description`
 * is likewise a key; the Select primitive resolves it where shown.
 *
 * Note: the backend stores but does not yet evaluate selective logic /
 * secondary keys during activation; revisit these descriptions when
 * evaluation lands.
 */
import type { LorebookEntryType, LorebookInsertionPosition, LorebookSelectiveLogic } from '@/shared'
import type { SelectOption } from '@/ui/primitives'

type LabelledOption<V extends string = string> = Omit<SelectOption, 'label'> & {
    value: V
    /** i18n key under `lorebookStudio.options.*` for the visible label. */
    labelKey: string
}

const ENTRY_TYPE_LABEL_KEYS: Record<LorebookEntryType, string> = {
    character: 'lorebookStudio.options.entryType.character',
    world: 'lorebookStudio.options.entryType.world',
    faction: 'lorebookStudio.options.entryType.faction',
    place: 'lorebookStudio.options.entryType.place',
    item: 'lorebookStudio.options.entryType.item',
    rule: 'lorebookStudio.options.entryType.rule',
    secret: 'lorebookStudio.options.entryType.secret',
    quest: 'lorebookStudio.options.entryType.quest',
    state: 'lorebookStudio.options.entryType.state',
    relationship: 'lorebookStudio.options.entryType.relationship',
    other: 'lorebookStudio.options.entryType.other',
}

export const ENTRY_TYPE_OPTIONS: Array<LabelledOption<LorebookEntryType>> = (
    Object.entries(ENTRY_TYPE_LABEL_KEYS) as Array<[LorebookEntryType, string]>
).map(([value, labelKey]) => ({ value, labelKey }))

/** Returns the i18n key for an entry type's label; resolve with `t()` at call sites. */
export function entryTypeLabelKey(type: LorebookEntryType): string {
    return ENTRY_TYPE_LABEL_KEYS[type] ?? type
}

export const SELECTIVE_LOGIC_OPTIONS: Array<LabelledOption<LorebookSelectiveLogic>> = [
    {
        value: 'any',
        labelKey: 'lorebookStudio.options.selectiveLogic.any.label',
        description: 'lorebookStudio.options.selectiveLogic.any.description',
    },
    {
        value: 'all',
        labelKey: 'lorebookStudio.options.selectiveLogic.all.label',
        description: 'lorebookStudio.options.selectiveLogic.all.description',
    },
    {
        value: 'and_any',
        labelKey: 'lorebookStudio.options.selectiveLogic.andAny.label',
        description: 'lorebookStudio.options.selectiveLogic.andAny.description',
    },
    {
        value: 'and_all',
        labelKey: 'lorebookStudio.options.selectiveLogic.andAll.label',
        description: 'lorebookStudio.options.selectiveLogic.andAll.description',
    },
    {
        value: 'not_any',
        labelKey: 'lorebookStudio.options.selectiveLogic.notAny.label',
        description: 'lorebookStudio.options.selectiveLogic.notAny.description',
    },
    {
        value: 'not_all',
        labelKey: 'lorebookStudio.options.selectiveLogic.notAll.label',
        description: 'lorebookStudio.options.selectiveLogic.notAll.description',
    },
]

export const INSERTION_POSITION_OPTIONS: Array<LabelledOption<LorebookInsertionPosition>> = [
    {
        value: 'before_context',
        labelKey: 'lorebookStudio.options.insertionPosition.beforeContext.label',
        description: 'lorebookStudio.options.insertionPosition.beforeContext.description',
    },
    {
        value: 'after_context',
        labelKey: 'lorebookStudio.options.insertionPosition.afterContext.label',
        description: 'lorebookStudio.options.insertionPosition.afterContext.description',
    },
    {
        value: 'author_note',
        labelKey: 'lorebookStudio.options.insertionPosition.authorNote.label',
        description: 'lorebookStudio.options.insertionPosition.authorNote.description',
    },
    {
        value: 'system',
        labelKey: 'lorebookStudio.options.insertionPosition.system.label',
        description: 'lorebookStudio.options.insertionPosition.system.description',
    },
]
