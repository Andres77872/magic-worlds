import type { StoryCardKind, StoryPlanItem } from '@/shared'

/** A novel Codex entry an approved fact can be applied to. */
export interface FactCodexEntry { id: string; label: string; kind: StoryCardKind; description: string; scopeLabel?: string; sourceId: string }
type Fact = StoryPlanItem<'fact'>

const fold = (value: string) => value.trim().toLocaleLowerCase()

/** The fact appended as its own paragraph; the author edits it before applying. */
export const factCodexText = (before: string, fact: Fact) => before.trim() ? `${before.trimEnd()}\n\n${fact.data.statement}` : fact.data.statement

/** The one entry that names the fact's subject (or its linked card), if exactly one does. */
export function suggestedFactEntry(fact: Fact, entries: FactCodexEntry[]): string {
    const named = entries.filter((entry) => fact.data.subjectCardId ? entry.sourceId === fact.data.subjectCardId : fold(entry.label) === fold(fact.data.subject))
    return named.length === 1 ? named[0].id : ''
}
