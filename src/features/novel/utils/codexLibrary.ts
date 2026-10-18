import type { StoryCardSnapshot, StoryCodexLibraryField, StoryCodexLibraryReview } from '@/shared'
import { canonicalJson } from '@/utils/json'

export const CODEX_LIBRARY_FIELDS: readonly StoryCodexLibraryField[] = ['name', 'alias', 'description', 'race', 'type', 'category']

/**
 * How one detail compares across the novel's copy, the library version it was copied from and the library's
 * current version: the novel already matches (`same`), only the library changed it (`updated`), only the novel
 * changed it (`edited`), both changed it differently (`both`), or it differs and the copied version is no longer
 * stored, so who changed it is unknown (`differs`).
 */
export type CodexFieldChange = 'same' | 'updated' | 'edited' | 'both' | 'differs'
type Value = StoryCardSnapshot[StoryCodexLibraryField]
export interface CodexFieldReview { field: StoryCodexLibraryField; novel: Value; library: Value; change: CodexFieldChange }

/** An absent, empty or blank detail reads the same everywhere. */
function detail(snapshot: Partial<Pick<StoryCardSnapshot, StoryCodexLibraryField>> | null | undefined, field: StoryCodexLibraryField): Value {
    const value = snapshot?.[field]
    if (value == null || (Array.isArray(value) ? value.length === 0 : !String(value).trim())) return null
    return value
}
const same = (a: Value, b: Value) => canonicalJson(a ?? null) === canonicalJson(b ?? null)

export function codexFieldReviews(novel: StoryCardSnapshot, review: StoryCodexLibraryReview): CodexFieldReview[] {
    return CODEX_LIBRARY_FIELDS.map((field) => {
        const mine = detail(novel, field), library = detail(review.current, field)
        const base = review.base ? detail(review.base, field) : undefined
        const change: CodexFieldChange = same(mine, library) ? 'same' : base === undefined ? 'differs'
            : same(mine, base) ? 'updated' : same(library, base) ? 'edited' : 'both'
        return { field, novel: mine, library, change }
    })
}

/** Only details that the novel never changed are taken from the library without asking. */
export const takenByDefault = (change: CodexFieldChange) => change === 'updated'

/** The novel's copy after taking the chosen details: it still needs a name or an alias. */
export function keepsDisplayName(reviews: CodexFieldReview[], take: ReadonlySet<StoryCodexLibraryField>): boolean {
    const after = (field: StoryCodexLibraryField) => { const row = reviews.find((item) => item.field === field); return row ? (take.has(field) ? row.library : row.novel) : null }
    return Boolean(after('name') || after('alias'))
}

/** The newer library version a Codex copy can review, if any. */
export function newerLibraryVersion(snapshot: StoryCardSnapshot, latest: number | undefined): number | null {
    return latest !== undefined && latest > (snapshot.source_card_version_number ?? 0) ? latest : null
}
