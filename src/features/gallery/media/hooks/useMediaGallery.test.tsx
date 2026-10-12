import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
    ImageJobListResponse,
    ImageJobPublic,
    ThemeSongJobPublic,
    UserThemeSongListResponse,
    WorkspaceMediaItem,
    WorkspaceMediaPage,
    WorkspaceMediaQuery,
} from '@/shared'
import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import type { CardTypeFilter } from '../mediaGalleryTypes'
import { useMediaGallery } from './useMediaGallery'

// The unscoped singleton must never serve these private reads.
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listImageJobs: vi.fn(),
        listUserThemeSongs: vi.fn(),
        listWorkspaceMedia: vi.fn(),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

function scopedClient() {
    return {
        listImageJobs: vi.fn<(opts: Record<string, unknown>) => Promise<ImageJobListResponse>>(),
        listUserThemeSongs: vi.fn<(opts: Record<string, unknown>) => Promise<UserThemeSongListResponse>>(),
        listWorkspaceMedia: vi.fn<(workspaceId: string, query: WorkspaceMediaQuery) => Promise<WorkspaceMediaPage>>(),
    }
}

/** The committed workspace's scoped clients (one per workspace). */
const clients = { [TEST_WORKSPACE_ID]: scopedClient(), [OTHER_WORKSPACE_ID]: scopedClient() }
const api = clients[TEST_WORKSPACE_ID]
const listImageJobs = api.listImageJobs
const listUserThemeSongs = api.listUserThemeSongs
const listWorkspaceMedia = api.listWorkspaceMedia

let workspace: WorkspaceTestState
const wrapper = ({ children }: { children: ReactNode }) => createElement(WorkspaceTestProvider, { state: workspace, children })

const PAGE_SIZE = 4


function imageJob(id: string, createdAt: string, assetCount = 1): ImageJobPublic {
    return {
        job_id: `job-${id}`,
        status: 'completed',
        model_alias: 'text_to_image_qwen',
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
        model_alias: 'minimax_music_3',
        status_url: '',
        result_url: '',
        lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 },
        assets: [
            {
                asset_id: `theme-${id}`,
                url: `/generated-audio/${id}.mp3`,
                content_type: 'audio/mpeg',
                file_size_bytes: 1,
                duration_ms: 61_000,
                output_format: 'mp3',
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


function imageMedia(id: string, workspaceId = TEST_WORKSPACE_ID): WorkspaceMediaItem {
    return {
        media_kind: 'image',
        asset_id: `img-${id}`,
        job_id: `job-${id}`,
        organization: { workspace_id: workspaceId },
        asset: { asset_id: `img-${id}`, url: `/images/assets/img-${id}`, content_type: 'image/jpeg', width: 512, height: 512 },
    }
}

function themeMedia(id: string, jobId: string | null = `job-${id}`): WorkspaceMediaItem {
    return {
        media_kind: 'theme_song',
        asset_id: `theme-${id}`,
        job_id: jobId,
        organization: { workspace_id: TEST_WORKSPACE_ID },
        asset: { asset_id: `theme-${id}`, url: `/theme-songs/assets/theme-${id}.mp3`, duration_ms: 61_000, output_format: 'mp3' },
    }
}

function mediaPage(items: WorkspaceMediaItem[], total: number, offset = 0): WorkspaceMediaPage {
    return { items, total, limit: PAGE_SIZE, offset }
}

/** The workspace media of one kind, served from `pages` by offset. */
function serveMedia(client: ReturnType<typeof scopedClient>, pages: { image?: WorkspaceMediaPage[]; theme_song?: WorkspaceMediaPage[] }) {
    client.listWorkspaceMedia.mockImplementation(async (_workspaceId, query) => {
        const kindPages = (query.media_kind === 'theme_song' ? pages.theme_song : pages.image) ?? []
        return kindPages.find((candidate) => candidate.offset === (query.offset ?? 0)) ?? mediaPage([], 0, query.offset ?? 0)
    })
}

async function renderFiltered(cardType: CardTypeFilter = 'character', options: { reactStrictMode?: boolean } = {}) {
    const hook = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper, ...options })
    act(() => hook.result.current.setCardType(cardType))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
}

beforeEach(() => {
    vi.clearAllMocks()
    for (const client of Object.values(clients)) {
        client.listImageJobs.mockReset()
        client.listUserThemeSongs.mockReset()
        client.listWorkspaceMedia.mockReset()
        client.listImageJobs.mockResolvedValue(imagesResponse([], null))
        client.listUserThemeSongs.mockResolvedValue(themesResponse([], null))
        client.listWorkspaceMedia.mockResolvedValue(mediaPage([], 0))
    }
    workspace = createWorkspaceTestState({
        api,
        overrides: {
            get api() {
                const selected = workspace.live.selectedWorkspaceId
                return (selected ? (clients as Record<string, typeof api>)[selected] ?? null : null) as never
            },
        },
    })
})

describe('useMediaGallery workspace discovery', () => {
    it('pages the workspace media of each kind by offset and interleaves them round-robin', async () => {
        serveMedia(api, {
            image: [mediaPage([imageMedia('1'), imageMedia('2'), imageMedia('3')], 3)],
            theme_song: [mediaPage([themeMedia('1', null), themeMedia('2')], 2)],
        })

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.items.map((item) => item.id)).toEqual(['img-1', 'theme-1', 'img-2', 'theme-2'])
        expect(result.current.hasMore).toBe(true)
        expect(listWorkspaceMedia).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { media_kind: 'image', limit: PAGE_SIZE, offset: 0 })
        expect(listWorkspaceMedia).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { media_kind: 'theme_song', limit: PAGE_SIZE, offset: 0 })
        expect(listImageJobs).not.toHaveBeenCalled()
        expect(listUserThemeSongs).not.toHaveBeenCalled()
        expect(apiService.listWorkspaceMedia).not.toHaveBeenCalled()

        const [image, theme] = result.current.items
        expect(image).toEqual({ kind: 'image', id: 'img-1', jobId: 'job-1', url: '/images/assets/img-1' })
        expect(theme).toMatchObject({ kind: 'theme', id: 'theme-1', jobId: 'theme-1', title: 'Theme song', durationMs: 61_000 })
        expect(theme.card).toBeUndefined()
        expect(theme.createdAt).toBeUndefined()

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))
        expect(result.current.items.map((item) => item.id)).toEqual(['img-1', 'theme-1', 'img-2', 'theme-2', 'img-3'])
        expect(result.current.hasMore).toBe(false)
    })

    it('continues a kind from its offset until the server total is reached', async () => {
        serveMedia(api, {
            image: [
                mediaPage([imageMedia('1'), imageMedia('2'), imageMedia('3'), imageMedia('4')], 6),
                mediaPage([imageMedia('5'), imageMedia('6')], 6, 4),
            ],
        })
        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))
        act(() => result.current.setMediaType('images'))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.items).toHaveLength(4)
        expect(result.current.hasMore).toBe(true)

        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))

        expect(result.current.items.map((item) => item.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4', 'img-5', 'img-6'])
        expect(listWorkspaceMedia).toHaveBeenLastCalledWith(TEST_WORKSPACE_ID, { media_kind: 'image', limit: PAGE_SIZE, offset: 4 })
        expect(listWorkspaceMedia).not.toHaveBeenCalledWith(TEST_WORKSPACE_ID, expect.objectContaining({ offset: 6 }))
        expect(result.current.hasMore).toBe(false)
    })

    it('reads only the matching kind for a media-type filter', async () => {
        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))
        listWorkspaceMedia.mockClear()

        act(() => result.current.setMediaType('themes'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(listWorkspaceMedia).toHaveBeenCalledTimes(1)
        expect(listWorkspaceMedia).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { media_kind: 'theme_song', limit: PAGE_SIZE, offset: 0 })
    })

    it('resets filters and feed on a workspace switch and refetches the new workspace from offset 0', async () => {
        listImageJobs.mockResolvedValue(imagesResponse([imageJob('i1', '2026-06-10T10:00:00')], null))
        const { result, rerender } = await renderFiltered('world')
        expect(result.current.items.map((item) => item.id)).toEqual(['img-i1'])

        const other = clients[OTHER_WORKSPACE_ID]
        serveMedia(other, { image: [mediaPage([imageMedia('b1', OTHER_WORKSPACE_ID)], 1)] })
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender()

        expect(result.current.filters).toEqual({ mediaType: 'all', cardType: 'all' })
        expect(result.current.items).toEqual([])
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.items.map((item) => item.id)).toEqual(['img-b1'])
        expect(other.listWorkspaceMedia).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, { media_kind: 'image', limit: PAGE_SIZE, offset: 0 })
    })

    it('ignores a page of the previous workspace that arrives after the switch', async () => {
        let releaseOld!: () => void
        listWorkspaceMedia.mockImplementation((_workspaceId, query) => new Promise((resolve) => {
            if (query.media_kind === 'image') releaseOld = () => resolve(mediaPage([imageMedia('stale')], 1))
            else resolve(mediaPage([], 0))
        }))
        const { result, rerender } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        await waitFor(() => expect(listWorkspaceMedia).toHaveBeenCalledTimes(2))

        const other = clients[OTHER_WORKSPACE_ID]
        serveMedia(other, { image: [mediaPage([imageMedia('fresh', OTHER_WORKSPACE_ID)], 1)] })
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender()
        await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['img-fresh']))

        await act(async () => releaseOld())
        expect(result.current.items.map((item) => item.id)).toEqual(['img-fresh'])
    })

    it('surfaces a load error with a retryable refresh', async () => {
        listWorkspaceMedia.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe('boom')
        expect(result.current.items).toEqual([])

        serveMedia(api, { image: [mediaPage([imageMedia('1')], 1)] })
        act(() => result.current.refresh())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeNull()
        expect(result.current.items.map((item) => item.id)).toEqual(['img-1'])
    })

    it('stops obsolete pagination after StrictMode replays the initial load', async () => {
        let resolveOld!: (page: WorkspaceMediaPage) => void
        listWorkspaceMedia
            .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
            .mockResolvedValueOnce(mediaPage([], 0))
            .mockResolvedValueOnce(mediaPage([imageMedia('current')], 1))
            .mockResolvedValueOnce(mediaPage([], 0))
        // Hold unexpected refills pending so a broken loop fails without flooding the test process.
        listWorkspaceMedia.mockImplementation(() => new Promise(() => {}))
        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper, reactStrictMode: true })
        await waitFor(() => expect(result.current.loading).toBe(false))

        await act(async () => resolveOld(mediaPage([imageMedia('old')], 9)))

        expect(listWorkspaceMedia).toHaveBeenCalledTimes(4)
        expect(result.current.items.map((item) => item.id)).toEqual(['img-current'])
        expect(result.current.hasMore).toBe(false)
    })

    it.each(['filter', 'disable', 'unmount'] as const)('stops obsolete pagination after %s', async (action) => {
        let resolveOld!: (page: WorkspaceMediaPage) => void
        listWorkspaceMedia.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
        listWorkspaceMedia.mockImplementation(() => new Promise(() => {}))
        const { result, rerender, unmount } = renderHook(
            ({ enabled }) => useMediaGallery(PAGE_SIZE, { enabled }),
            { wrapper, initialProps: { enabled: true } },
        )
        await waitFor(() => expect(listWorkspaceMedia).toHaveBeenCalledTimes(2))
        if (action === 'filter') {
            act(() => result.current.setMediaType('themes'))
        } else if (action === 'disable') {
            rerender({ enabled: false })
            expect(result.current.loading).toBe(false)
        } else {
            unmount()
        }
        const callsBefore = listWorkspaceMedia.mock.calls.length

        await act(async () => resolveOld(mediaPage([], 9)))
        expect(listWorkspaceMedia.mock.calls.filter(([, query]) => query.media_kind === 'image' && (query.offset ?? 0) > 0)).toEqual([])
        expect(listWorkspaceMedia.mock.calls.length).toBe(callsBefore)
    })
})

describe('useMediaGallery card-filtered job histories', () => {
    it('merges both sources newest-first into one page', async () => {
        listImageJobs.mockResolvedValueOnce(
            imagesResponse([imageJob('i1', '2026-06-10T10:00:00'), imageJob('i2', '2026-06-10T08:00:00')], null),
        )
        listUserThemeSongs.mockResolvedValueOnce(themesResponse([themeJob('t1', '2026-06-10T09:00:00')], null))

        const { result } = await renderFiltered()

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'theme-t1', 'img-i2'])
        expect(result.current.hasMore).toBe(false)
        // The job histories of the committed workspace's scoped client, never the singleton.
        expect(listImageJobs).toHaveBeenCalledWith({
            status: 'completed',
            limit: PAGE_SIZE,
            offset: 0,
            cardType: 'character',
            cardId: undefined,
        })
        expect(listUserThemeSongs).toHaveBeenCalledWith({
            status: 'completed',
            limit: PAGE_SIZE,
            offset: 0,
            targetType: 'character',
            targetId: undefined,
        })
        expect(apiService.listImageJobs).not.toHaveBeenCalled()
        expect(apiService.listUserThemeSongs).not.toHaveBeenCalled()
    })

    it('orders merged sources by parsed API timestamps instead of string comparison', async () => {
        listImageJobs.mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00+02:00')], null))
        listUserThemeSongs.mockResolvedValueOnce(themesResponse([themeJob('t1', '2026-06-10T09:00:00')], null))

        const { result } = await renderFiltered()

        expect(result.current.items.map((i) => i.id)).toEqual(['theme-t1', 'img-i1'])
    })

    it('flattens multi-asset image jobs into separate tiles', async () => {
        listImageJobs.mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00', 2)], null))

        const { result } = await renderFiltered()

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1-0', 'img-i1-1'])
    })

    it('carries image prompt metadata from the image job to each tile item', async () => {
        listImageJobs.mockResolvedValueOnce(
            imagesResponse(
                [
                    {
                        ...imageJob('i1', '2026-06-10T10:00:00'),
                        generation_prompt: 'Image-only illustration of a moon gate.',
                    },
                ],
                null,
            ),
        )

        const { result } = await renderFiltered()

        const item = result.current.items[0]
        expect(item.kind).toBe('image')
        if (item.kind === 'image') {
            expect(item.prompt).toBe('Image-only illustration of a moon gate.')
            expect(item.modelAlias).toBe('text_to_image_qwen')
        }
    })

    it('keeps paging a source whose buffer runs dry mid-page (refill before pop)', async () => {
        // Images: newest first across two server pages; themes interleave between them.
        listImageJobs
            .mockResolvedValueOnce(imagesResponse([imageJob('i1', '2026-06-10T10:00:00')], PAGE_SIZE))
            .mockResolvedValueOnce(imagesResponse([imageJob('i2', '2026-06-09T10:00:00')], null))
        listUserThemeSongs.mockResolvedValueOnce(
            themesResponse([themeJob('t1', '2026-06-09T12:00:00'), themeJob('t2', '2026-06-09T08:00:00')], null),
        )

        const { result } = await renderFiltered()

        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'theme-t1', 'img-i2', 'theme-t2'])
        expect(listImageJobs).toHaveBeenCalledTimes(2)
    })

    it('media-type filter fetches only that source and resets the feed', async () => {
        const { result } = await renderFiltered()
        listImageJobs.mockClear()
        listUserThemeSongs.mockClear()

        act(() => result.current.setMediaType('themes'))
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(listUserThemeSongs).toHaveBeenCalledTimes(1)
        expect(listImageJobs).not.toHaveBeenCalled()
    })

    it('card-type and specific-card filters reach both sources as server params', async () => {
        const { result } = await renderFiltered()

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

        // Changing the card type clears the picked card; "all types" is discovery again.
        listWorkspaceMedia.mockClear()
        act(() => result.current.setCardType('all'))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.filters.card).toBeUndefined()
        expect(listWorkspaceMedia).toHaveBeenCalled()
    })

    it('discards stale in-flight responses when filters change mid-fetch', async () => {
        let resolveSlow: (value: ImageJobListResponse) => void = () => {}
        listImageJobs.mockImplementationOnce(
            () => new Promise<ImageJobListResponse>((resolve) => (resolveSlow = resolve)),
        )

        const { result } = renderHook(() => useMediaGallery(PAGE_SIZE), { wrapper })
        act(() => result.current.setCardType('character'))
        await waitFor(() => expect(listImageJobs).toHaveBeenCalledTimes(1))
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

        const { result } = await renderFiltered()
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

        const { result } = await renderFiltered()
        expect(result.current.items).toHaveLength(PAGE_SIZE)

        act(() => result.current.removeItem('img-i2'))
        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'img-i3', 'img-i4'])

        act(() => result.current.removeItem('img-i5'))
        act(() => result.current.loadMore())
        await waitFor(() => expect(result.current.loadingMore).toBe(false))
        expect(result.current.items.map((i) => i.id)).toEqual(['img-i1', 'img-i3', 'img-i4'])
    })
})
