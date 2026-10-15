/**
 * useCodex — the novel's isolated collection of cloned snapshots, derived
 * from story-level card refs (chapterId null). Cards are cloned server-side
 * on add; lorebook entries are cloned client-side (the backend cannot resolve
 * entry ids). Edits touch only the novel's copy, never the source card.
 *
 * Workspace R1: ops start only while the story's workspace is the committed
 * one; the story refetch they trigger is DataProvider's (owner-guarded) state.
 * While that workspace is archived the codex is read-only (`readOnly`): the
 * entries stay readable and mentionable, and no op is ever sent.
 */

import { useCallback, useMemo, useState } from 'react'
import { useData } from '@/app/hooks'
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'
import type { SessionLoreEntry } from '@/features/lorebook/loreTriggers'
import type { Lorebook, Story, StoryCardKind, StoryCardRef, StoryCardSnapshot } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import {
    KIND_META,
    clonedEntryIds,
    lorebookEntryFromSnapshot,
    lorebookEntrySnapshot,
    snapshotDescription,
    snapshotLabel,
} from '../utils/codexUtils'
import type { StoryWorkspace } from './useStoryWorkspace'

/** Kinds whose names are highlighted inline in the manuscript (ember). */
const DETECTABLE_NAME_KINDS = new Set<StoryCardKind>(['character', 'world', 'item', 'adventure_template'])

/** A codex entity name surfaced for inline detection. */
export interface CodexDetectionName {
    id: string
    label: string
    kind: StoryCardKind
}

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
    groups: Array<{ kind: StoryCardKind; labelKey: string; entries: CodexEntry[] }>
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
    /** Enabled entity names highlighted inline in the manuscript (ember). */
    detectionNames: CodexDetectionName[]
    /** Cloned lorebook entries as session lore, for inline trigger detection (arcane). */
    loreEntries: SessionLoreEntry[]
    busy: boolean
    /** The story's workspace is archived: every op above is a no-op until it is restored. */
    readOnly: boolean
}

interface CodexOptions {
    story: Story | null
    /** The open story's workspace (captured when the story was opened). */
    workspace: StoryWorkspace
}

export function useCodex({ story, workspace }: CodexOptions): CodexApi {
    const { addStoryCardRefs, updateStoryCardRef, deleteStoryCardRef } = useData()
    const [pendingOps, setPendingOps] = useState(0)
    const storyId = story?.id ?? null
    const readOnly = useWorkspaceReadOnly(workspace.workspaceId)

    // An op starts only while the story's workspace is committed (DataProvider
    // writes target the committed workspace) and not archived. The busy count is
    // this component's own bookkeeping, so a late completion still balances it.
    const track = useCallback(async <T,>(start: () => Promise<T>): Promise<T | undefined> => {
        if (readOnly || !workspace.isCurrent()) return undefined
        setPendingOps((count) => count + 1)
        try {
            return await start()
        } finally {
            setPendingOps((count) => count - 1)
        }
    }, [readOnly, workspace])

    // Keep every stored ref for precedence; availability only projects what
    // this build can display or act on. Never rewrite hidden snapshots.
    const storedRefs = useMemo(
        () =>
            (story?.activeCardRefs ?? [])
                .filter((ref) => !ref.chapterId)
                .sort((a, b) => a.precedence - b.precedence),
        [story?.activeCardRefs],
    )

    const refs = useMemo(() => storedRefs.filter((ref) => isContentTypeFeatureEnabled(ref.kind)), [storedRefs])

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
                labelKey: meta.pluralKey,
                entries: entries.filter((entry) => entry.kind === meta.kind),
            })).filter((group) => group.entries.length > 0),
        [entries],
    )

    const existingCardKeys = useMemo(() => new Set(refs.map((ref) => `${ref.kind}:${ref.cardId}`)), [refs])
    const existingEntryIds = useMemo(() => clonedEntryIds(refs), [refs])

    const nextPrecedence = useCallback(
        () => storedRefs.reduce((max, ref) => Math.max(max, ref.precedence + 1), 0),
        [storedRefs],
    )

    const addCards = useCallback(
        async (cards: Array<{ kind: StoryCardKind; cardId: string }>) => {
            if (!storyId || cards.length === 0) return
            if (cards.some((card) => !isContentTypeFeatureEnabled(card.kind))) return
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
            await track(() => addStoryCardRefs(storyId, payloads))
        },
        [addStoryCardRefs, nextPrecedence, storyId, track],
    )

    const cloneLorebookEntries = useCallback(
        async (lorebook: Lorebook, entryIds: string[]) => {
            if (!storyId || entryIds.length === 0) return
            if (!isContentTypeFeatureEnabled('lorebook_entry')) return
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
            await track(() => addStoryCardRefs(storyId, payloads))
        },
        [addStoryCardRefs, nextPrecedence, storyId, track],
    )

    const toggleEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            await track(() => updateStoryCardRef(storyId, entry.id, { enabled: !entry.enabled }))
        },
        [storyId, track, updateStoryCardRef],
    )

    const saveSnapshot = useCallback(
        async (entry: CodexEntry, patch: { label: string; description: string }) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            // Merge, never replace: card snapshots keep stored race/category/source pins.
            const snapshot: StoryCardSnapshot = {
                ...entry.ref.snapshot,
                name: patch.label,
                description: patch.description,
            }
            await track(() => updateStoryCardRef(storyId, entry.id, { snapshot }))
        },
        [storyId, track, updateStoryCardRef],
    )

    const removeEntry = useCallback(
        async (entry: CodexEntry) => {
            if (!storyId || !isContentTypeFeatureEnabled(entry.kind)) return
            await track(() => deleteStoryCardRef(storyId, entry.id))
        },
        [deleteStoryCardRef, storyId, track],
    )

    const mentionEntries = useMemo<CodexMentionEntry[]>(
        () => entries.map((entry) => ({ id: entry.id, label: entry.label, kind: entry.kind, enabled: entry.enabled })),
        [entries],
    )

    const detectionNames = useMemo<CodexDetectionName[]>(
        () =>
            entries
                .filter((entry) => entry.enabled && DETECTABLE_NAME_KINDS.has(entry.kind) && entry.label.trim().length > 0)
                .map((entry) => ({ id: entry.id, label: entry.label, kind: entry.kind })),
        [entries],
    )

    // Reconstruct cloned lorebook entries into session lore. snapshotToLoreEntry
    // forces enabled:true, so re-apply the codex ref's own enabled flag — a
    // disabled codex row must not light up its triggers in the prose.
    const loreEntries = useMemo<SessionLoreEntry[]>(
        () =>
            refs
                .filter((ref) => ref.kind === 'lorebook_entry')
                .map((ref) => {
                    const entry = {
                        ...lorebookEntryFromSnapshot(ref.snapshot, ref.cardId),
                        enabled: ref.enabled,
                    }
                    return {
                        entry,
                        lorebookId: entry.lorebookId,
                        lorebookName: ref.snapshot.source_lorebook_id ?? '',
                    }
                }),
        [refs],
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
        detectionNames,
        loreEntries,
        busy: pendingOps > 0,
        readOnly,
    }
}
