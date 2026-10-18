/**
 * Accept the latest assistant suggestion of several scenes as one manuscript changeset, with one Undo (R14, prose half).
 * Each suggestion is checked like a single review, applied to its scene's saved text the way the editor accepts it,
 * and all scenes are written in one request. Undo puts back the earlier text only where a scene still holds the
 * accepted text; a scene written since keeps the later writing and the result says so.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '@/infrastructure/api'
import { MAX_CHANGESET_SCENES, MIN_CHANGESET_SCENES } from '@/infrastructure/api/storyGenerationChangesetContract'
import type { StoryGenerationChangeset, StoryGenerationChangesetItem, StoryGenerationChangesetUndo, StoryGenerationChangesetWrite } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { makeRequestId } from '@/utils/uuid'
import { applySavedGeneration } from '../editor/applySavedGeneration'
import type { NovelAssistantSource } from './useNovelAssistantSource'

/** Why nothing changed: the open scene must be saved first, a suggestion or its scene changed, it no longer fits, or the request failed. */
export type SuggestionsTogetherFailure = 'blocked' | 'changed' | 'notApplicable' | 'failed' | 'undoNothing' | 'undoFailed'
interface Options {
    source: NovelAssistantSource | null
    readOnly: boolean
    /** Saves the open scene and confirms nothing (a live suggestion, a pending write) holds it; false leaves everything as it is. */
    beforeWrite: () => Promise<boolean>
    /** Loads the outline the written scenes now belong to, so the open scene reloads. */
    refresh: (storyId: string) => Promise<unknown>
    onAccepted: (generationIds: string[]) => void
    /** While true the open scene must stay as it is: its writer is blocked and it reads as read-only. */
    onBusy?: (busy: boolean) => void
}
interface State {
    scope: string | null
    busy: boolean
    changeset: StoryGenerationChangeset | null
    undo: StoryGenerationChangesetUndo | null
    failure: SuggestionsTogetherFailure | null
    /** A sent request whose outcome is unknown: retried as the same request, never prepared again. */
    retry: { write: StoryGenerationChangesetWrite } | { undoRequestId: string } | null
}
const idle = (scope: string | null): State => ({ scope, busy: false, changeset: null, undo: null, failure: null, retry: null })
const definite = (error: unknown) => error instanceof ApiError && [400, 403, 404, 409, 422].includes(error.status)

/** The latest suggestion of each scene in a conversation, in reading order of the replies. */
export function latestSceneSuggestions(records: NovelAssistantRecord[]): NovelAssistantRecord[] {
    const latest = new Map<string, NovelAssistantRecord>()
    for (const record of records) if (record.result.proposal) { latest.delete(record.result.proposal.sceneId); latest.set(record.result.proposal.sceneId, record) }
    return [...latest.values()]
}

export function useSuggestionsTogether({ source, readOnly, beforeWrite, refresh, onAccepted, onBusy }: Options) {
    const scope = source?.key ?? null
    const [stored, setState] = useState<State>(() => idle(scope))
    const state = stored.scope === scope ? stored : idle(scope)
    const live = useRef({ source, readOnly, beforeWrite, refresh, onAccepted, onBusy, state })
    useLayoutEffect(() => { live.current = { source, readOnly, beforeWrite, refresh, onAccepted, onBusy, state } })
    const flight = useRef(false)
    const update = useCallback((owner: NovelAssistantSource, patch: Partial<State>) => {
        if (live.current.source?.key !== owner.key) return
        setState((old) => ({ ...(old.scope === owner.key ? old : idle(owner.key)), ...patch, scope: owner.key }))
        if (patch.busy !== undefined) live.current.onBusy?.(patch.busy)
    }, [])

    const send = useCallback(async (owner: NovelAssistantSource, write: StoryGenerationChangesetWrite) => {
        try {
            let changeset: StoryGenerationChangeset | null = null
            try { changeset = await owner.acceptTogether(write) } catch (error) {
                if (definite(error)) throw error
                changeset = await owner.recoverTogether(write).catch(() => null)
                if (!changeset) throw error
            }
            if (owner.isCurrent()) live.current.onAccepted(write.items.map((item) => item.generationId))
            await live.current.refresh(owner.storyId).catch(() => undefined)
            update(owner, { busy: false, changeset, undo: null, failure: null, retry: null })
            return true
        } catch (error) {
            const changed = error instanceof ApiError && error.status === 409
            update(owner, { busy: false, failure: changed ? 'changed' : 'failed', retry: definite(error) ? null : { write } })
            return false
        }
    }, [update])

    const accept = useCallback(async (records: NovelAssistantRecord[]) => {
        const owner = live.current.source
        if (!owner || !owner.isCurrent() || live.current.readOnly || live.current.state.busy || flight.current) return false
        const chosen = latestSceneSuggestions(records)
        if (chosen.length < MIN_CHANGESET_SCENES || chosen.length > MAX_CHANGESET_SCENES) return false
        flight.current = true
        try {
            if (!await live.current.beforeWrite() || !owner.isCurrent()) { update(owner, { failure: 'blocked' }); return false }
            update(owner, { busy: true, failure: null, retry: null })
            const controller = new AbortController(), items: StoryGenerationChangesetItem[] = []
            for (const record of chosen) {
                const proposal = record.result.proposal!
                try {
                    const { detail } = await owner.reviewCandidate(record, controller.signal)
                    const saved = await owner.sceneDocument(proposal.sceneId)
                    if (saved.revision !== proposal.baseRevision || saved.contentHash !== proposal.baseContentHash) { update(owner, { busy: false, failure: 'changed' }); return false }
                    const applied = applySavedGeneration({ generation: detail.generation, operation: proposal.operation, document: saved.document })
                    if (!applied) { update(owner, { busy: false, failure: 'notApplicable' }); return false }
                    items.push({ generationId: proposal.id, sceneId: proposal.sceneId, expectedRevision: saved.revision, document: applied.document,
                        ...(applied.anchorEdits ? { anchorEdits: applied.anchorEdits } : {}) })
                } catch (error) {
                    update(owner, { busy: false, failure: error instanceof ApiError && error.status === 409 ? 'changed' : 'failed' }); return false
                }
            }
            if (!owner.isCurrent()) { update(owner, { busy: false }); return false }
            return await send(owner, { requestId: makeRequestId('suggestions-together'), items })
        } finally { flight.current = false }
    }, [send, update])

    const undo = useCallback(async () => {
        const owner = live.current.source, changeset = live.current.state.changeset
        if (!owner || !changeset || !owner.isCurrent() || live.current.readOnly || live.current.state.busy || flight.current) return false
        const pending = live.current.state.retry
        const requestId = pending && 'undoRequestId' in pending ? pending.undoRequestId : makeRequestId('suggestions-undo')
        flight.current = true
        try {
            // The open scene's unsaved writing is saved first, so the undo sees it and keeps it.
            if (!await live.current.beforeWrite() || !owner.isCurrent()) { update(owner, { failure: 'blocked' }); return false }
            update(owner, { busy: true, failure: null, retry: null })
            try {
                const result = await owner.undoTogether(changeset, requestId)
                await live.current.refresh(owner.storyId).catch(() => undefined)
                update(owner, { busy: false, undo: result, failure: null, retry: null })
                return true
            } catch (error) {
                const nothing = error instanceof ApiError && error.code === 'STORY_CHANGESET_NOT_UNDOABLE'
                update(owner, { busy: false, failure: nothing ? 'undoNothing' : 'undoFailed', retry: definite(error) ? null : { undoRequestId: requestId } })
                return false
            }
        } finally { flight.current = false }
    }, [update])

    const retry = useCallback(async () => {
        const owner = live.current.source, pending = live.current.state.retry
        if (!owner || !pending || !owner.isCurrent() || live.current.state.busy || flight.current) return false
        if ('undoRequestId' in pending) return undo()
        flight.current = true
        try {
            if (!await live.current.beforeWrite() || !owner.isCurrent()) { update(owner, { failure: 'blocked' }); return false }
            update(owner, { busy: true, failure: null })
            return await send(owner, pending.write)
        } finally { flight.current = false }
    }, [send, undo, update])

    const dismiss = useCallback(() => { const owner = live.current.source; if (owner && !live.current.state.busy) update(owner, idle(owner.key)) }, [update])
    return { busy: state.busy, changeset: state.changeset, undoResult: state.undo, failure: state.failure, canRetry: Boolean(state.retry),
        accept, undo, retry, dismiss, readOnly }
}
export type SuggestionsTogether = ReturnType<typeof useSuggestionsTogether>
