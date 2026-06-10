import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageJobListResponse, ImageJobPublic, ThemeSongJobPublic, UserThemeSongListResponse } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { useMediaGallery } from './useMediaGallery'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listImageJobs: vi.fn(),
        listUserThemeSongs: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

const listImageJobs = vi.mocked(apiService.listImageJobs)
const listUserThemeSongs = vi.mocked(apiService.listUserThemeSongs)

const PAGE_SIZE = 4

function imageJob(id: string, createdAt: string, assetCount = 1): ImageJobPublic {
    return {
        job_id: `job-${id}`,
        status: 'completed',
        status_url: '',
        result_url: '',
        assets: Array.from({ length: assetCount }, (_, i) => ({
            asset_id: `img-${id}${assetCount > 1 ? `-${i}` : ''}`,
            url: `/generated-images/${id}-${i}.jpeg`,
            content_type: 'image/jpeg' as const,
        })),
        created_at: createdAt,
        updated_at: createdAt,
    }
}

function themeJob(id: string, createdAt: string): ThemeSongJobPublic {
    return {
        job_id: `job-${id}`,
        target: { type: 'character', id: 'card-1', display_name: 'Lyra' },
        operation: 'theme_song',
        status: 'completed',
        model_alias: 'music_2_6',
        status_url: '',
        result_url: '',
        lyrics: { song_title: `Song ${id}`, style_tags: ['epic'] },
        assets: [
            {
                asset_id: `theme-${id}`,
                url: `/generated-audio/${id}.mp3`,
                content_type: 'audio/mpeg',
                file_size_bytes: 1,
                duration_ms: 61_000,
            },
        ],
        created_at: createdAt,
        updated_at: createdAt,
    }
}

function imagesResponse(items: ImageJobPublic[], nextOffset: number | null): ImageJobListResponse {
    return { items, limit: PAGE_SIZE, offset: 0, next_offset: nextOffset }
}

function themesResponse(items: ThemeSongJobPublic[], nextOffset: number | null): UserThemeSongListResponse {
    return { items, limit: PAGE_SIZE, offset: 0, next_offset: nextOffset }
}

beforeEach(() => {
    listImageJobs.mockReset()
    listUserThemeSongs.mockReset()
    listImageJobs.mockResolvedValue(imagesResponse([], null))
    listUserThemeSongs.mockResolvedValue(themesResponse([], null))
})

describe('useMediaGallery', () => {
    it('merges both sources newest-first into one page', async () => {
        listImageJobs.mockResolvedValueOnce(
            imagesResponse([imageJob('i1', '2026-06-10T10:00:00'), imageJob('i2', '2026-06-10T08:00:00')], null),
        )
        listUserThemeSongs.mockResolvedValueOnce(themesResponse([themeJob('t1', '2026-06-10T09:00:00')], null))

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'theme-t1', 'img-i2'])
        expect(result.current.hasMore).toBe(false)
        expect(listImageJobs).toHaveBeenCalledWith({
            status: 'completed',
            limit: PAGE_SIZE,
            offset: 0,
            cardType: undefined,
            cardId: undefined,
        })
        expect(listUserThemeSongs).toHaveBeenCalledWith({
            status: 'completed',
            limit: PAGE_SIZE,
            offset: 0,
            targetType: undefined,
            targetId: undefined,
        })
    })

    it('flattens multi-asset image jobs into separate tiles', async () => {
        listImageJobs.mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00', 2)], null))

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1-0', 'img-i1-1'])
    })

    it('keeps paging a source whose buffer runs dry mid-page (refill before pop)', async () => {
        // Images: newest first across two server pages; themes interleave between them.
        listImageJobs
            .mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00')], PAGE_SIZE))
            .mockResolvedValueOnce(imagesResponse([imageJob('i2', '2026-06-09T10:00:00')], null))
        listUserThemeSongs.mockResolvedValueOnce(
            themesResponse([themeJob('t1', '2026-06-09T12:00:00'), themeJob('t2', '2026-06-09T08:00:00')], null),
        )

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'theme-t1', 'img-i2', 'theme-t2'])
        expect(listImageJobs).toHaveBeenCalledTimes(2)
    })

    it('media-type filter fetches only that source and resets the feed', async () => {
        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))
        listImageJobs.mockClear()
        listUserThemeSongs.mockClear()

        act(() => result.current.setMediaType('themes'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(listUserThemeSongs).toHaveBeenCalledTimes(1)
        expect(listImageJobs).not.toHaveBeenCalled()
    })

    it('card-type and specific-card filters reach both sources as server params', async () => {
        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => result.current.setCardType('world'))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(listImageJobs).toHaveBeenLastCalledWith(expect.objectContaining({ cardType: 'world', cardId: undefined }))
        expect(listUserThemeSongs).toHaveBeenLastCalledWith(
            expect.objectContaining({ targetType: 'world', targetId: undefined }),
        )

        act(() => result.current.setCard({ type: 'character', id: 'card-9', name: 'Lyra' }))
        await waitFor(() => expect(result.current.loading).toBe(false))
        // Picking a card narrows the type scope to the card's own.
        expect(result.current.filters.cardType).toBe('character')
        expect(listImageJobs).toHaveBeenLastCalledWith(
            expect.objectContaining({ cardType: 'character', cardId: 'card-9' }),
        )
        expect(listUserThemeSongs).toHaveBeenLastCalledWith(
            expect.objectContaining({ targetType: 'character', targetId: 'card-9' }),
        )

        // Changing the card type clears the picked card.
        act(() => result.current.setCardType('all'))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.filters.card).toBeUndefined()
    })

    it('discards stale in-flight responses when filters change mid-fetch', async () => {
        let resolveSlow: (value: ImageJobListResponse) => void = () => {}
        listImageJobs.mockImplementationOnce(
            () => new Promise<ImageJobListResponse>((resolve) => (resolveSlow = resolve)),
        )

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        // While the first images fetch hangs, switch to themes-only (new ticket).
        act(() => result.current.setMediaType('themes'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        act(() => resolveSlow(imagesResponse([imageJob('stale', '2026-06-10T10:00:00')], null)))
        await waitFor(() => expect(result.current.items).toEqual([]))
    })

    it('loadMore appends from the live source and hasMore tracks next_offset', async () => {
        listImageJobs
            .mockResolvedValueOnce(
                imagesResponse(
                    [
                        imageJob('i1', '2026-06-10T10:00:00'),
                        imageJob('i2', '2026-06-10T09:00:00'),
                        imageJob('i3', '2026-06-10T08:00:00'),
                        imageJob('i4', '2026-06-10T07:00:00'),
                    ],
                    PAGE_SIZE,
                ),
            )
            .mockResolvedValueOnce(imagesResponse([imageJob('i5', '2026-06-10T06:00:00')], null))

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.hasMore).toBe(true)

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'img-i2', 'img-i3', 'img-i4', 'img-i5'])
        expect(result.current.hasMore).toBe(false)
        expect(listImageJobs).toHaveBeenLastCalledWith(expect.objectContaining({ offset: PAGE_SIZE }))
    })

    it('removeItem drops emitted items and purges buffered copies', async () => {
        listImageJobs.mockResolvedValueOnce(
            imagesResponse(
                [
                    imageJob('i1', '2026-06-10T10:00:00'),
                    imageJob('i2', '2026-06-10T09:00:00'),
                    imageJob('i3', '2026-06-10T08:00:00'),
                    imageJob('i4', '2026-06-10T07:00:00'),
                    // Flattened past the page size: stays buffered, unemitted.
                    imageJob('i5', '2026-06-10T06:00:00'),
                ],
                null,
            ),
        )

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.items).toHaveLength(PAGE_SIZE)

        act(() => result.current.removeItem('img-i2'))
        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'img-i3', 'img-i4'])

        act(() => result.current.removeItem('img-i5'))
        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))
        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'img-i3', 'img-i4'])
    })

    it('surfaces a load error with a retryable refresh', async () => {
        listImageJobs.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('boom')
        expect(result.current.items).toEqual([])

        listImageJobs.mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00')], null))
        act(() => result.current.refresh())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeNull()
        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1'])
    })
})
