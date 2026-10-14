/**
 * useCreatorWorkspace — where a creator saves (Workspace R1, document 08
 * "Creation from the unified library" and document 15 "Boundary and transport").
 *
 * - A NEW card (manual create, the auto-save before media generation, direct AI
 *   generation, the card assistant's first card) goes to the captured creation
 *   origin: `apiService.withWorkspace(origin.workspaceId, { initialCollectionIds })`.
 * - An EXISTING card (draft, publish, versions, media, usage, assistant edits)
 *   stays in its own workspace — its `organization.workspace_id`, else the
 *   workspace this creator just created it in, else the committed one — and
 *   never sends initial collections (an edit is not another add-to-collection).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkspace, type WorkspaceScopeCapture } from '@/app/hooks/useWorkspace'
import { ApiError, apiService, isWorkspaceApiError, type ApiService } from '@/infrastructure/api'
import {
    initialCollectionIds as originCollectionIds,
    useCreationOrigin,
    type CreatedCardRef,
    type CreationOrigin,
} from '@/features/library/creationOrigin'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { isWorkspaceArchived } from '@/shared/hooks/useWorkspaceReadOnly'
import type { CardOrganization, RootOrganization } from '@/shared/types/workspace.types'
import { voiceWriteErrorKey } from '@/shared/voice/voiceWriteErrors'
import { voiceWriteErrorCode } from '@/features/voices/voiceWriteError'

export interface CreatorWorkspaceApi {
    /** The captured destination of a new card; null before the workspace handshake. */
    origin: CreationOrigin | null
    /** Initial memberships a new card is created with (`X-Initial-Collection-Ids`). */
    initialCollectionIds: readonly string[]
    /** The workspace the edited card lives in; the origin's while nothing is saved yet. */
    cardWorkspaceId: string | null
    /**
     * The workspace this creator writes to is archived: the editor is read-only
     * (no save, publish, restore, generation, media or assistant turns). Viewing,
     * version history and Back keep working (document 08: archived is read-only).
     */
    readOnly: boolean
    /** Client for creating a NEW card at the origin (with its initial collections). */
    newCardClient: () => ApiService
    /** Client for the edited card's own workspace (never initial collections). */
    cardClient: () => ApiService
    /** Record where a card was just created (a create response may omit organization). */
    rememberCreated: (organization?: CardOrganization | RootOrganization | null) => void
    /**
     * Back to the captured Library location — after a successful manual creation
     * (highlighting `created`) or from Back (`null`); false = keep the existing behavior.
     */
    returnToLibrary: (created: CreatedCardRef | null) => boolean
    /** Capture the active scope before a write; compare with `isCurrent` before updating the UI. */
    capture: () => WorkspaceScopeCapture | null
    /** False once the user switched workspace or signed out since `capture()`. */
    isCurrent: (scope: WorkspaceScopeCapture | null | undefined) => boolean
}

function requireWorkspace(workspaceId: string | null | undefined): string {
    if (!workspaceId) throw new Error('No workspace is selected yet.')
    return workspaceId
}

export function useCreatorWorkspace(
    editing: { organization?: CardOrganization | RootOrganization | null } | null | undefined,
): CreatorWorkspaceApi {
    const { selectedWorkspaceId, workspaces, capture, isCurrent } = useWorkspace()
    const { origin: libraryOrigin, isCaptured, clear, returnToLibrary: returnToCapturedLibrary } = useCreationOrigin()
    const [createdIn, setCreatedIn] = useState<string | null>(null)

    // A Library origin captured before a committed switch belongs to the previous workspace:
    // the fresh form saves to the selected root instead and never returns into the old folder.
    const stale = isCaptured && libraryOrigin !== null && selectedWorkspaceId !== null
        && libraryOrigin.workspaceId !== selectedWorkspaceId
    useEffect(() => {
        if (stale) clear()
    }, [stale, clear])
    const origin = useMemo<CreationOrigin | null>(
        () => (stale && selectedWorkspaceId ? { workspaceId: selectedWorkspaceId, collectionId: null, returnTo: null } : libraryOrigin),
        [stale, selectedWorkspaceId, libraryOrigin],
    )
    const returnToLibrary = useCallback(
        (created: CreatedCardRef | null) => (stale ? false : returnToCapturedLibrary(created)),
        [stale, returnToCapturedLibrary],
    )

    const collections = useMemo(() => originCollectionIds(origin), [origin])
    const cardWorkspaceId = editing
        ? organizationWorkspaceId(editing) ?? createdIn ?? selectedWorkspaceId
        : origin?.workspaceId ?? null

    const writesTo = editing ? cardWorkspaceId : origin?.workspaceId ?? null
    const readOnly = isWorkspaceArchived(workspaces, writesTo)

    const newCardClient = useCallback(
        () => apiService.withWorkspace(requireWorkspace(origin?.workspaceId), { initialCollectionIds: collections }),
        [origin, collections],
    )
    const cardClient = useCallback(() => apiService.withWorkspace(requireWorkspace(cardWorkspaceId)), [cardWorkspaceId])
    const rememberCreated = useCallback((organization?: CardOrganization | RootOrganization | null) => {
        setCreatedIn(organization?.workspace_id ?? origin?.workspaceId ?? null)
    }, [origin])

    return {
        origin,
        initialCollectionIds: collections,
        cardWorkspaceId,
        readOnly,
        newCardClient,
        cardClient,
        rememberCreated,
        returnToLibrary,
        capture,
        isCurrent,
    }
}

/** Copy key for a save the workspace refused (deleted origin collection, archived workspace); null otherwise. */
export function workspaceSaveErrorKey(error: unknown): string | null {
    if (isWorkspaceApiError(error, 'COLLECTION_NOT_FOUND')) return 'workspaceContent.saveErrors.collectionMissing'
    if (isWorkspaceApiError(error, 'WORKSPACE_ARCHIVED')) return 'workspaceContent.saveErrors.archived'
    return null
}

/**
 * Copy key for a save the voice write rules refused (I-36: a 422 voice code,
 * mapped through `voiceWriteErrorKey`); null otherwise.
 */
export function voiceSaveErrorKey(error: unknown): string | null {
    if (!(error instanceof ApiError) || error.status !== 422) return null
    const code = voiceWriteErrorCode(error)
    return code ? voiceWriteErrorKey(code) : null
}
