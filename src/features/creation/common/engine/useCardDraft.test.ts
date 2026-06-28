import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { apiService } from '@/infrastructure/api'
import { useCardDraft } from './useCardDraft'

afterEach(() => {
    vi.restoreAllMocks()
})

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
})
