/**
 * useCodex — the novel's isolated collection of cloned snapshots, derived
 * from story-level card refs (chapterId null). Cards are cloned server-side
 * on add; lorebook entries are cloned client-side (the backend cannot resolve
 * entry ids). Edits touch only the novel's copy, never the source card.
 */

import { useCallback, useMemo, useState } from 'react'
import { useData } from '@/app/hooks'
import type { Lorebook, Story, StoryCardKind, StoryCardRef } from '@/shared'
import { KIND_META, clonedEntryIds, lorebookEntrySnapshot, snapshotDescription, snapshotLabel } from '../utils/codexUtils'

export interface CodexEntry {
    /** The card-ref id (the codex row identity). */
    id: string
    kind: StoryCardKind
    label: string
    description: string
    enabled: boolean
    ref: StoryCardRef
}

export interface CodexMentionEntry {
    id: string
    label: string
    kind: StoryCardKind
    enabled: boolean
}

export interface CodexApi {
    entries: CodexEntry[]
    groups: Array<{ kind: StoryCardKind; label: string; entries: CodexEntry[] }>
    /** `${kind}:${cardId}` keys already in the codex (picker "In codex" badges). */
    existingCardKeys: Set<string>
    /** Lorebook entry ids already cloned (picker "In codex" badges). */
    existingEntryIds: Set<string>
    addCards: (cards: Array<{ kind: StoryCardKind; cardId: string }>) => Promise<void>
    cloneLorebookEntries: (lorebook: Lorebook, entryIds: string[]) => Promise<void>
    toggleEntry: (entry: CodexEntry) => Promise<void>
    saveSnapshot: (entry: CodexEntry, patch: { label: string; description: string }) => Promise<void>
    removeEntry: (entry: CodexEntry) => Promise<void>
    /** Feed for the editor's @mention autocomplete. */
    mentionEntries: CodexMentionEntry[]
    busy: boolean
}

export function useCodex({ story }: { story: Story | null }): CodexApi {
    const { addStoryCardRefs, updateStoryCardRef, deleteStoryCardRef } = useData()
    const [pendingOps, setPendingOps] = useState(0)

    const track = useCallback(async <T,>(operation: Promise<T>): Promise<T> => {
        setPendingOps((count) => count + 1)
        try {
            return await operation
        } finally {
            setPendingOps((count) => count - 1)
        }
    }, [])

    const storyId = story?.id ?? null
    const refs = useMemo(
        () =>
            (story?.activeCardRefs ?? [])
                .filter((ref) => !ref.chapterId)
                .sort((a, b) => a.precedence - b.precedence),
        [story?.activeCardRefs],
    )

    const entries = useMemo<CodexEntry[]>(
        () =>
            refs.map((ref) => ({
                id: ref.id,
                kind: ref.kind,
                label: snapshotLabel(ref),
                description: snapshotDescription(ref),
                enabled: ref.enabled,
                ref,
            })),
        [refs],
    )

    const groups = useMemo(
        () =>
            KIND_META.map((meta) => ({
                kind: meta.kind,
                label: meta.plural,
                entries: entries.filter((entry) => entry.kind === meta.kind),
            })).filter((group) => group.entries.length > 0),
        [entries],
    )

    const existingCardKeys = useMemo(() => new Set(refs.map((ref) => `${ref.kind}:${ref.cardId}`)), [refs])
    const existingEntryIds = useMemo(() => clonedEntryIds(refs), [refs])

    const nextPrecedence = useCallback(
        () => refs.reduce((max, ref) => Math.max(max, ref.precedence + 1), 0),
        [refs],
    )

    const addCards = useCallback(
        async (cards: Array<{ kind: StoryCardKind; cardId: string }>) => {
            if (!storyId || cards.length === 0) return
            let precedence = nextPrecedence()
            // No snapshot here: the backend clones the card itself on POST.
            const payloads = cards.map((card) => ({
                kind: card.kind,
                cardId: card.cardId,
                source: 'manual',
                enabled: true,
                precedence: precedence++,
                chapterId: null,
            }))
            await track(addStoryCardRefs(storyId, payloads))
        },
        [addStoryCardRefs, nextPrecedence, storyId, track],
    )

    const cloneLorebookEntries = useCallback(
        async (lorebook: Lorebook, entryIds: string[]) => {
            if (!storyId || entryIds.length === 0) return
            let precedence = nextPrecedence()
            const selected = lorebook.entries.filter((entry) => entryIds.includes(entry.id))
            const payloads = selected.map((entry) => ({
                kind: 'lorebook_entry',
                cardId: entry.id,
                source: 'manual',
                enabled: entry.enabled,
                precedence: precedence++,
                chapterId: null,
                snapshot: lorebookEntrySnapshot(lorebook, entry),
            }))
            await track(addStoryCardRefs(storyId, payloads))
        },
        [addStoryCardRefs, nextPrecedence, storyId, track],
    )

    const toggleEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId) return
            await track(updateStoryCardRef(storyId, entry.id, { enabled: !entry.enabled }))
        },
        [storyId, track, updateStoryCardRef],
    )

    const saveSnapshot = useCallback(
        async (entry: CodexEntry, patch: { label: string; description: string }) => {
            if (!storyId) return
            // Merge, never replace: card snapshots keep race/category/image_url.
            const snapshot: Record<string, unknown> = {
                ...(entry.ref.snapshot ?? {}),
                name: patch.label,
                title: patch.label,
                description: patch.description,
            }
            if (entry.kind === 'lorebook_entry' || entry.kind === 'lorebook') snapshot.content = patch.description
            await track(updateStoryCardRef(storyId, entry.id, { snapshot }))
        },
        [storyId, track, updateStoryCardRef],
    )

    const removeEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId) return
            await track(deleteStoryCardRef(storyId, entry.id))
        },
        [deleteStoryCardRef, storyId, track],
    )

    const mentionEntries = useMemo<CodexMentionEntry[]>(
        () => entries.map((entry) => ({ id: entry.id, label: entry.label, kind: entry.kind, enabled: entry.enabled })),
        [entries],
    )

    return {
        entries,
        groups,
        existingCardKeys,
        existingEntryIds,
        addCards,
        cloneLorebookEntries,
        toggleEntry,
        saveSnapshot,
        removeEntry,
        mentionEntries,
        busy: pendingOps > 0,
    }
}
