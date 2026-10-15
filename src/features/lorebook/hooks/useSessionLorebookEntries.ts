/**
 * useSessionLorebookEntries — resolves the lorebook entries that are "in play" for a
 * chat/adventure session and compiles a trigger matcher from them, so the composer and
 * transcript can mark words that touch session lore.
 *
 * Loading mirrors `SessionLorebookPanel`: list the session's attachments, then resolve
 * each to a Lorebook — a frozen `snapshot` when the attachment is a snapshot, otherwise
 * the live book from the global `useData()` cache, fetching on demand for any linked
 * book the cache hasn't loaded yet. The matcher is memoized so `ChatMessage`'s `memo`
 * still skips re-renders.
 *
 * Workspace R1: reads use the session's workspace (`workspaceId`, when the host knows
 * it) or the committed one. The `useData()` cache is consulted only when it is that
 * workspace's; a committed switch drops the previous scope's attachments and books.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { Lorebook, LorebookAttachment, LorebookTargetKind } from '@/shared'
import { isLorebookResourcesFeatureEnabled, isLorebooksFeatureEnabled } from '@/shared/featureFlags'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { normalizeLorebook, normalizeLorebookAttachment } from '../lorebookTransforms'
import { lorebookResourceActivationEntries } from '../lorebookResources'
import { buildTriggerMatcher, type SessionLoreEntry, type TriggerMatcher } from '../loreTriggers'

export type SessionLorebookTargetKind = Extract<LorebookTargetKind, 'character_chat' | 'adventure_session'>

export interface UseSessionLorebookEntriesResult {
    entries: SessionLoreEntry[]
    /** Null when there is nothing to mark (no session lorebooks / no keys). */
    matcher: TriggerMatcher | null
}

const NO_LOREBOOKS: Lorebook[] = []

export function useSessionLorebookEntries(
    targetKind: SessionLorebookTargetKind,
    targetId: string,
    workspaceId?: string | null,
): UseSessionLorebookEntriesResult {
    const data = useData()
    const api = useScopedApi(workspaceId)
    const { selectedWorkspaceId } = useWorkspace()
    const lorebooks = !workspaceId || workspaceId === selectedWorkspaceId ? data.lorebooks : NO_LOREBOOKS
    const lorebooksEnabled = isLorebooksFeatureEnabled()
    const resourceFeaturesEnabled = isLorebookResourcesFeatureEnabled()
    const [attachments, setAttachments] = useState<LorebookAttachment[]>([])
    const [fetched, setFetched] = useState<Record<string, Lorebook>>({})
    const attemptedRef = useRef<Set<string>>(new Set())
    const normalizedTargetId = targetId.trim()

    // Another client (a committed switch, or the host's session workspace) is another
    // scope: nothing loaded for the previous one carries over.
    const [loadedWith, setLoadedWith] = useState(api)
    if (loadedWith !== api) {
        setLoadedWith(api)
        setAttachments([])
        setFetched({})
    }

    useEffect(() => {
        // No session id or workspace yet → nothing to load; `attachments` stays empty
        // (a session's id is stable for the panel's lifetime).
        if (!lorebooksEnabled || !normalizedTargetId || !api) return
        // A new scope may resolve linked books the previous one could not.
        attemptedRef.current = new Set()
        let mounted = true
        void api
            .listLorebookAttachments(targetKind, normalizedTargetId)
            .then((rows) => {
                if (mounted) setAttachments(rows.map(normalizeLorebookAttachment))
            })
            .catch(() => {
                if (mounted) setAttachments([])
            })
        return () => {
            mounted = false
        }
    }, [api, normalizedTargetId, targetKind, lorebooksEnabled])

    const lorebookById = useMemo(() => new Map(lorebooks.map((book) => [book.id, book])), [lorebooks])

    // Fetch any linked book the global cache hasn't loaded. Snapshots are self-contained.
    useEffect(() => {
        if (!lorebooksEnabled || !api) return
        const missing = attachments
            .filter(
                (a) =>
                    a.mode !== 'snapshot' &&
                    !lorebookById.has(a.lorebookId) &&
                    !attemptedRef.current.has(a.lorebookId),
            )
            .map((a) => a.lorebookId)
        const unique = Array.from(new Set(missing))
        if (unique.length === 0) return
        unique.forEach((id) => attemptedRef.current.add(id))
        let mounted = true
        void Promise.all(
            unique.map((id) =>
                api
                    .getLorebook(id)
                    .then((book) => [id, normalizeLorebook(book)] as const)
                    .catch(() => null),
            ),
        ).then((results) => {
            if (!mounted) return
            const next: Record<string, Lorebook> = {}
            for (const result of results) if (result) next[result[0]] = result[1]
            if (Object.keys(next).length) setFetched((current) => ({ ...current, ...next }))
        })
        return () => {
            mounted = false
        }
    }, [api, attachments, lorebookById, lorebooksEnabled])

    const entries = useMemo<SessionLoreEntry[]>(() => {
        if (!lorebooksEnabled) return []
        const flat: SessionLoreEntry[] = []
        for (const attachment of attachments) {
            const book =
                attachment.mode === 'snapshot' && attachment.snapshot
                    ? attachment.snapshot
                    : lorebookById.get(attachment.lorebookId) ?? fetched[attachment.lorebookId]
            if (!book || !book.enabled) continue
            const resourceEntries = resourceFeaturesEnabled ? lorebookResourceActivationEntries(book) : []
            for (const entry of [...book.entries, ...resourceEntries]) {
                flat.push({ entry, lorebookId: book.id, lorebookName: book.name })
            }
        }
        return flat
    }, [attachments, lorebookById, fetched, resourceFeaturesEnabled, lorebooksEnabled])

    const matcher = useMemo<TriggerMatcher | null>(() => {
        const built = buildTriggerMatcher(entries)
        return built.keys.length > 0 ? built : null
    }, [entries])

    return { entries, matcher }
}
