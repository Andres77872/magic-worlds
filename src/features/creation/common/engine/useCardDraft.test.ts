import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError, apiService, type ApiService } from '@/infrastructure/api'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { useCardDraft } from './useCardDraft'

// Workspace R1: the committed workspace's scoped client inherits the singleton spies below.
const workspaceMock = vi.hoisted(() => ({ state: null as WorkspaceTestState | null }))
vi.mock('@/app/hooks/useWorkspace', () => ({ useWorkspace: () => workspaceMock.state!.value() }))

beforeEach(() => {
    workspaceMock.state = createWorkspaceTestState({ api: apiService.withWorkspace(TEST_WORKSPACE_ID) })
})

afterEach(() => {
    vi.restoreAllMocks()
})

/** The workspace a spied call was made through (its scoped client's frozen scope). */
function calledInWorkspace(spy: { mock: { contexts: unknown[] } }, index = 0): string | null {
    return (spy.mock.contexts[index] as ApiService | undefined)?.workspaceScope?.workspaceId ?? null
}

describe('useCardDraft', () => {
    it('stays idle (no fetch) until a card has been created', () => {
        const spy = vi.spyOn(apiService, 'getCardDraft')
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: null }))
        expect(result.current.draftState).toBeNull()
        expect(result.current.hasDraft).toBe(false)
        expect(spy).not.toHaveBeenCalled()
    })

    it('re-hydrates the form once when a pending draft exists on open', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({
            id: 'c1',
            name: 'Draft Nyra',
            is_draft: true,
            based_on_version_number: 2,
            latest_version_number: 2,
        })
        const onDraftLoaded = vi.fn()
        const { result } = renderHook(() =>
            useCardDraft({ cardType: 'character', cardId: 'c1', onDraftLoaded }),
        )

        await waitFor(() => expect(result.current.hasDraft).toBe(true))
        expect(result.current.draftState?.basedOnVersionNumber).toBe(2)
        expect(onDraftLoaded).toHaveBeenCalledTimes(1)
        expect(onDraftLoaded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Draft Nyra' }))
    })

    it('does not re-hydrate when the published body is returned (no draft)', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({
            id: 'c2',
            is_draft: false,
            latest_version_number: 0,
        })
        const onDraftLoaded = vi.fn()
        const { result } = renderHook(() =>
            useCardDraft({ cardType: 'world', cardId: 'c2', onDraftLoaded }),
        )

        await waitFor(() => expect(result.current.draftState).not.toBeNull())
        expect(result.current.hasDraft).toBe(false)
        expect(onDraftLoaded).not.toHaveBeenCalled()
    })

    it('saveDraft writes the payload to the draft and flips hasDraft', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c3', is_draft: false, latest_version_number: 1 })
        const save = vi
            .spyOn(apiService, 'saveCardDraft')
            .mockResolvedValue({ id: 'c3', is_draft: true, based_on_version_number: 1, latest_version_number: 1 })
        const { result } = renderHook(() => useCardDraft({ cardType: 'item', cardId: 'c3' }))
        // Let the on-open draft fetch settle first (else it could clobber the save result).
        await waitFor(() => expect(result.current.draftState).not.toBeNull())

        let ok = false
        await act(async () => {
            ok = await result.current.saveDraft({ name: 'Edited' })
        })
        expect(ok).toBe(true)
        expect(save).toHaveBeenCalledWith('item', 'c3', { name: 'Edited' })
        await waitFor(() => expect(result.current.hasDraft).toBe(true))
    })

    it('publish promotes the draft and clears hasDraft', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c4', is_draft: true, based_on_version_number: 2, latest_version_number: 2 })
        const publish = vi
            .spyOn(apiService, 'publishCardDraft')
            .mockResolvedValue({ version_id: 'v3', version_number: 3, label: 'cut', card: { id: 'c4' } })
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: 'c4' }))
        await waitFor(() => expect(result.current.hasDraft).toBe(true))

        let publishedVersion = 0
        await act(async () => {
            const res = await result.current.publish('cut')
            publishedVersion = res?.version_number ?? 0
        })
        expect(publish).toHaveBeenCalledWith('character', 'c4', 'cut')
        expect(publishedVersion).toBe(3)
        await waitFor(() => expect(result.current.hasDraft).toBe(false))
        expect(result.current.draftState?.latestVersionNumber).toBe(3)
    })

    it('surfaces an i18n error key when a save fails', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c5', is_draft: false, latest_version_number: 0 })
        vi.spyOn(apiService, 'saveCardDraft').mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: 'c5' }))
        await waitFor(() => expect(result.current.draftState).not.toBeNull())

        let ok = true
        await act(async () => {
            ok = await result.current.saveDraft({ name: 'x' })
        })
        expect(ok).toBe(false)
        await waitFor(() => expect(result.current.error).toBe('cardVersions.errors.draftSave'))
    })

    it('maps a voice write refusal to its copy key and hands the failure to onError', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c5', is_draft: false, latest_version_number: 0 })
        const refusal = new ApiError(422, 'Plan locked', { code: 'voice_plan_locked' })
        vi.spyOn(apiService, 'saveCardDraft').mockRejectedValue(refusal)
        const onError = vi.fn()
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: 'c5' }))
        await waitFor(() => expect(result.current.draftState).not.toBeNull())

        let ok = true
        await act(async () => {
            ok = await result.current.saveDraft({ name: 'x' }, { onError })
        })
        expect(ok).toBe(false)
        expect(onError).toHaveBeenCalledExactlyOnceWith(refusal)
        await waitFor(() => expect(result.current.error).toBe('voices.errors.planLocked'))
    })

    it('keeps the generic draftSave key for a non-voice failure and still reports it', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c5', is_draft: false, latest_version_number: 0 })
        const failure = new ApiError(500, 'Server error')
        vi.spyOn(apiService, 'saveCardDraft').mockRejectedValue(failure)
        const onError = vi.fn()
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: 'c5' }))
        await waitFor(() => expect(result.current.draftState).not.toBeNull())

        await act(async () => {
            await result.current.saveDraft({ name: 'x' }, { onError })
        })
        expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
        await waitFor(() => expect(result.current.error).toBe('cardVersions.errors.draftSave'))
    })

    it('version=<n> loads a read-only historical body without touching the draft', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c6', is_draft: true, based_on_version_number: 3, latest_version_number: 3 })
        const getVersion = vi
            .spyOn(apiService, 'getCardVersion')
            .mockResolvedValue({ id: 'c6', name: 'Nyra v2', is_historical: true, viewing_version_number: 2 })
        const restore = vi.spyOn(apiService, 'restoreVersionIntoDraft')
        const onDraftLoaded = vi.fn()
        const { result } = renderHook(() =>
            useCardDraft({ cardType: 'character', cardId: 'c6', version: 2, onDraftLoaded }),
        )

        await waitFor(() => expect(result.current.isHistorical).toBe(true))
        expect(getVersion).toHaveBeenCalledWith('character', 'c6', 2)
        expect(result.current.viewingVersionNumber).toBe(2)
        expect(onDraftLoaded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nyra v2' }))
        // Read-only view: the draft endpoint must never be written.
        expect(restore).not.toHaveBeenCalled()
    })

    it('version=latest hydrates the published body and ignores the draft', async () => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c7', is_draft: true, based_on_version_number: 1, latest_version_number: 1 })
        const getPublished = vi
            .spyOn(apiService, 'getPublishedBody')
            .mockResolvedValue({ id: 'c7', name: 'Published Nyra', is_draft: false })
        const onDraftLoaded = vi.fn()
        const { result } = renderHook(() =>
            useCardDraft({ cardType: 'character', cardId: 'c7', version: 'latest', onDraftLoaded }),
        )

        await waitFor(() => expect(getPublished).toHaveBeenCalledWith('character', 'c7'))
        expect(result.current.isHistorical).toBe(false)
        expect(onDraftLoaded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Published Nyra' }))
    })

    it.each([2, 'latest'] as const)('retries an interrupted version %s when returning to the same card', async (version) => {
        vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c1', is_draft: false })
        let resolveBody!: (body: { id: string; name: string }) => void
        const pending = new Promise<{ id: string; name: string }>(resolve => { resolveBody = resolve })
        const getBody = version === 'latest'
            ? vi.spyOn(apiService, 'getPublishedBody').mockReturnValue(pending)
            : vi.spyOn(apiService, 'getCardVersion').mockReturnValue(pending)
        const onDraftLoaded = vi.fn()
        const { result, rerender } = renderHook(
            ({ cardId }: { cardId: string | null }) => useCardDraft({ cardType: 'character', cardId, version, onDraftLoaded }),
            { initialProps: { cardId: 'c1' as string | null }, reactStrictMode: true },
        )
        await waitFor(() => expect(getBody).toHaveBeenCalled())

        rerender({ cardId: null })
        expect(result.current.loading).toBe(false)
        rerender({ cardId: 'c1' })
        await act(async () => resolveBody({ id: 'c1', name: 'Requested version' }))

        expect(onDraftLoaded).toHaveBeenCalledExactlyOnceWith({ id: 'c1', name: 'Requested version' })
        expect(result.current.loading).toBe(false)
        expect(result.current.isHistorical).toBe(typeof version === 'number')
    })

    it('reads and writes drafts through the committed workspace by default', async () => {
        const get = vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c8', is_draft: false, latest_version_number: 1 })
        const save = vi.spyOn(apiService, 'saveCardDraft').mockResolvedValue({ id: 'c8', is_draft: true, latest_version_number: 1 })
        const { result } = renderHook(() => useCardDraft({ cardType: 'character', cardId: 'c8' }))
        await waitFor(() => expect(result.current.draftState).not.toBeNull())
        await act(async () => {
            await result.current.saveDraft({ name: 'Edited' })
        })

        expect(calledInWorkspace(get)).toBe(TEST_WORKSPACE_ID)
        expect(calledInWorkspace(save)).toBe(TEST_WORKSPACE_ID)
        expect((save.mock.contexts[0] as ApiService).workspaceScope?.initialCollectionIds).toEqual([])
    })

    it("keeps an existing card's draft in the card's own workspace", async () => {
        const get = vi.spyOn(apiService, 'getCardDraft').mockResolvedValue({ id: 'c9', is_draft: false, latest_version_number: 1 })
        const publish = vi.spyOn(apiService, 'publishCardDraft')
            .mockResolvedValue({ version_id: 'v2', version_number: 2, label: null, card: { id: 'c9' } })
        const { result } = renderHook(() =>
            useCardDraft({ cardType: 'world', cardId: 'c9', workspaceId: OTHER_WORKSPACE_ID }),
        )
        await waitFor(() => expect(result.current.draftState).not.toBeNull())
        await act(async () => {
            await result.current.publish()
        })

        expect(calledInWorkspace(get)).toBe(OTHER_WORKSPACE_ID)
        expect(calledInWorkspace(publish)).toBe(OTHER_WORKSPACE_ID)
    })
})
