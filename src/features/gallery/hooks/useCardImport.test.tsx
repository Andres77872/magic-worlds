import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiService } from '@/infrastructure/api'
import type { SharedCardResource } from '@/shared'
import type { GalleryItem } from '../galleryConfig'
import { useCardImport } from './useCardImport'

const openLoginModal = vi.fn()
const loadData = vi.fn().mockResolvedValue(undefined)
const setPage = vi.fn()
let authed = true

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useData: () => ({ loadData }),
    useNavigation: () => ({ setPage }),
}))

type ResourceOverride = { already_imported?: boolean; existing_card_id?: string | null }

function item(resource?: ResourceOverride): GalleryItem {
    return {
        id: 'card-1',
        title: 'Nyra',
        tags: [],
        backendType: 'character',
        galleryType: 'character',
        source: {} as GalleryItem['source'],
        resource: resource ? ({ card_type: 'character', card: {}, ...resource } as SharedCardResource) : undefined,
    }
}

beforeEach(() => {
    authed = true
    openLoginModal.mockClear()
    loadData.mockClear()
    setPage.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('useCardImport', () => {
    it('clones a public card and refreshes the library on success', async () => {
        const clone = vi.spyOn(apiService, 'cloneCard').mockResolvedValue({ card_type: 'character', card: {} } as never)
        const { result } = renderHook(() => useCardImport())

        await act(async () => {
            await result.current.requestImport({ kind: 'clone', item: item() })
        })

        expect(clone).toHaveBeenCalledWith('character', 'card-1', { force: false })
        expect(loadData).toHaveBeenCalledWith({ silent: true })
        expect(result.current.actionNotice?.tone).toBe('success')
    })

    it('prompts login when not authenticated and never calls the API', async () => {
        authed = false
        const clone = vi.spyOn(apiService, 'cloneCard')
        const { result } = renderHook(() => useCardImport())

        await act(async () => {
            await result.current.requestImport({ kind: 'clone', item: item() })
        })

        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(clone).not.toHaveBeenCalled()
    })

    it('warns before re-importing an already-imported card, then force-imports on confirm', async () => {
        const clone = vi.spyOn(apiService, 'cloneCard').mockResolvedValue({ card_type: 'character', card: {} } as never)
        const { result } = renderHook(() => useCardImport())

        await act(async () => {
            await result.current.requestImport({
                kind: 'clone',
                item: item({ already_imported: true, existing_card_id: 'mine-1' }),
            })
        })
        expect(clone).not.toHaveBeenCalled()
        expect(result.current.pendingConfirm?.existingCardId).toBe('mine-1')

        await act(async () => {
            await result.current.confirmForceImport()
        })
        expect(clone).toHaveBeenCalledWith('character', 'card-1', { force: true })
        expect(result.current.pendingConfirm).toBeNull()
    })

    it('opens the confirm dialog when the server returns 409 (race)', async () => {
        vi.spyOn(apiService, 'cloneCard').mockRejectedValue(
            new ApiError(409, 'already imported', { details: { existing_card_id: 'mine-9' } }),
        )
        const { result } = renderHook(() => useCardImport())

        await act(async () => {
            await result.current.requestImport({ kind: 'clone', item: item() })
        })

        expect(result.current.pendingConfirm?.existingCardId).toBe('mine-9')
    })

    it('imports a shared card via the share token', async () => {
        const importShared = vi.spyOn(apiService, 'importSharedCard').mockResolvedValue({ card_type: 'character', card: {} } as never)
        const { result } = renderHook(() => useCardImport())

        await act(async () => {
            await result.current.requestImport({ kind: 'shared', token: 'tok-1', item: item() })
        })

        expect(importShared).toHaveBeenCalledWith('tok-1', { force: false })
    })

    it('navigates to the existing copy via openExisting', () => {
        const { result } = renderHook(() => useCardImport())
        act(() => {
            result.current.openExisting('mine-1', 'character')
        })
        expect(setPage).toHaveBeenCalledTimes(1)
    })
})
