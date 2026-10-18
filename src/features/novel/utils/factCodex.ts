import type { StoryCardKind, StoryCodexDiscoveryDestination, StoryFactCodexCreation, StoryFactCodexField, StoryPlanItem } from '@/shared'

/** A novel Codex entry an approved fact can be applied to, with the details a review can change. */
export interface FactCodexEntry {
    id: string; label: string; kind: StoryCardKind; description: string; scopeLabel?: string; sourceId: string
    /** The entry's current name, alias, race and type ('' when unset); absent fields read as ''. */
    values?: Partial<Record<StoryFactCodexField, string>>
}
type Fact = StoryPlanItem<'fact'>

const fold = (value: string) => value.trim().toLocaleLowerCase()
const squash = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()

/** The fact appended as its own paragraph; the author edits it before applying. */
export const factCodexText = (before: string, fact: Fact) => before.trim() ? `${before.trimEnd()}\n\n${fact.data.statement}` : fact.data.statement

/** Whether a text already holds the fact's statement, so nothing is proposed for it. */
export const holdsFact = (text: string, fact: Fact) => squash(text).includes(squash(fact.data.statement))

/** The one entry that names the fact's subject (or its linked card), if exactly one does. */
export function suggestedFactEntry(fact: Fact, entries: FactCodexEntry[]): string {
    const named = entries.filter((entry) => fact.data.subjectCardId ? entry.sourceId === fact.data.subjectCardId : fold(entry.label) === fold(fact.data.subject))
    return named.length === 1 ? named[0].id : ''
}

/** The details a review can change for an entry of this kind: a character's race, a setting's or item's type. */
export function factCodexFields(kind: StoryCardKind | StoryCodexDiscoveryDestination | 'reference'): StoryFactCodexField[] {
    if (kind === 'character') return ['name', 'alias', 'race', 'description']
    if (kind === 'world' || kind === 'item') return ['name', 'alias', 'type', 'description']
    if (kind === 'lorebook_entry') return ['name', 'description']
    return ['name', 'alias', 'description']
}

/** One reviewable detail: its current value and, when the author changes it, the new one. */
export interface FactFieldRow { key: string; before: string; multiline?: boolean }
export type FactFieldDraft = Record<string, { change: boolean; text: string }>

/**
 * Where a review starts: the text field (description or content) gets the statement as its own paragraph unless it
 * already holds it; every other detail is kept until the author chooses to change it.
 */
export function initialFactFields(rows: FactFieldRow[], fact: Fact, textKey: string): FactFieldDraft {
    return Object.fromEntries(rows.map((row) => {
        const proposed = row.key === textKey && !holdsFact(row.before, fact)
        return [row.key, { change: proposed, text: proposed ? factCodexText(row.before, fact) : row.before }]
    }))
}

/** The details the author chose to change to a different, non-empty value (an alias may be cleared). */
export function changedFactFields(rows: FactFieldRow[], draft: FactFieldDraft): Record<string, string> {
    return Object.fromEntries(rows.flatMap((row) => {
        const value = draft[row.key]
        if (!value?.change) return []
        const text = row.multiline ? value.text : value.text.trim()
        return text !== row.before && (text.trim() || row.key === 'alias') ? [[row.key, text]] : []
    }))
}

/** Lorebook keys typed as a comma-separated list: trimmed, empty ones dropped, each once. */
export const parseFactKeys = (value: string) => [...new Set(value.split(',').map((key) => key.trim()).filter(Boolean))]
/** The most keys a new lorebook entry, or a write to an existing one, takes. */
export const FACT_KEYS_NEW = 20, FACT_KEYS_WRITE = 50

/** What a new destination records on the fact. */
export type FactCodexDestination = 'reference' | StoryCodexDiscoveryDestination
export const factCreation = (destination: FactCodexDestination): StoryFactCodexCreation => destination
