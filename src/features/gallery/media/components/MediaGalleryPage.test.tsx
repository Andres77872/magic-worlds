import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const openLoginModal = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, openLoginModal }),
    useData: () => ({
        characters: [],
        worlds: [{ id: 'card-2', name: 'Rivendell', image_url: '/generated-images/rivendell.jpeg' }],
        items: [],
        templateAdventures: [],
    }),
}))

// AudioWavePlayer deep-imports the playlist hook (not the barrel), so the
// global player gets its own inert stub.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({
        queue: [],
        currentIndex: -1,
        currentTrack: null,
        isPlaying: false,
        isLoading: false,
        error: null,
        currentTime: 0,
        duration: null,
        peaks: null,
        playNow: vi.fn(),
        enqueue: vi.fn(),
        playQueueFrom: vi.fn(),
        toggle: vi.fn(),
        next: vi.fn(),
        prev: vi.fn(),
        stop: vi.fn(),
        removeAt: vi.fn(),
        clearAndClose: vi.fn(),
        seekRatio: vi.fn(),
        isQueued: () => false,
    }),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listImageJobs: vi.fn(),
        listUserThemeSongs: vi.fn(),
        deleteImageAsset: vi.fn().mockResolvedValue(undefined),
        deleteThemeSongAsset: vi.fn().mockResolvedValue(undefined),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import type { ImageJobPublic, ThemeSongJobPublic } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { clearAudioDataCaches } from '@/ui/components/audio'
import { MediaGalleryPage } from './MediaGalleryPage'

const IMAGE_JOB: ImageJobPublic = {
    job_id: 'job-i1',
    status: 'completed',
    status_url: '',
    result_url: '',
    assets: [{ asset_id: 'img-1', url: '/generated-images/1.jpeg', content_type: 'image/jpeg' }],
    card_type: 'character',
    card_id: 'card-1',
    card_name: 'Lyra',
    created_at: '2026-06-10T10:00:00',
    updated_at: '2026-06-10T10:00:00',
}

const THEME_JOB: ThemeSongJobPublic = {
    job_id: 'job-t1',
    target: { type: 'world', id: 'card-2', display_name: 'Rivendell' },
    operation: 'theme_song',
    status: 'completed',
    model_alias: 'music_2_6',
    status_url: '',
    result_url: '',
    lyrics: { song_title: 'Ember Hymn', style_tags: ['epic', 'choral'] },
    assets: [
        {
            asset_id: 'theme-1',
            url: '/generated-audio/1.mp3',
            content_type: 'audio/mpeg',
            file_size_bytes: 1,
            duration_ms: 95_000,
        },
    ],
    created_at: '2026-06-10T09:00:00',
    updated_at: '2026-06-10T09:00:00',
}

describe('MediaGalleryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        clearAudioDataCaches()
        vi.mocked(apiService.listImageJobs).mockResolvedValue({
            items: [IMAGE_JOB],
            limit: 24,
            offset: 0,
            next_offset: null,
        })
        vi.mocked(apiService.listUserThemeSongs).mockResolvedValue({
            items: [THEME_JOB],
            limit: 24,
            offset: 0,
            next_offset: null,
        })
    })

    it('renders a mixed feed with both renderers, newest first', async () => {
        render(<MediaGalleryPage />)

        expect(await screen.findByTestId('media-image-tile')).toBeInTheDocument()
        expect(screen.getByTestId('media-theme-card')).toBeInTheDocument()
        expect(screen.getByText('Ember Hymn')).toBeInTheDocument()
        expect(screen.getByText('1:35')).toBeInTheDocument()

        const grid = screen.getByTestId('card-grid-list')
        const tiles = grid.querySelectorAll('[data-testid="media-image-tile"], [data-testid="media-theme-card"]')
        expect(tiles[0].getAttribute('data-testid')).toBe('media-image-tile')
    })

    it('media-type chips refetch only the matching source', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        vi.mocked(apiService.listImageJobs).mockClear()
        vi.mocked(apiService.listUserThemeSongs).mockClear()

        fireEvent.click(screen.getByTestId('media-filter-themes'))

        await waitFor(() => expect(apiService.listUserThemeSongs).toHaveBeenCalled())
        expect(apiService.listImageJobs).not.toHaveBeenCalled()
        await waitFor(() => expect(screen.queryByTestId('media-image-tile')).not.toBeInTheDocument())
    })

    it("clicking a tile's card badge filters to that card and syncs the type chip", async () => {
        render(<MediaGalleryPage />)
        const badges = await screen.findAllByTestId('media-card-badge')

        fireEvent.click(badges.find((b) => b.textContent?.includes('Lyra'))!)

        await waitFor(() =>
            expect(apiService.listImageJobs).toHaveBeenLastCalledWith(
                expect.objectContaining({ cardType: 'character', cardId: 'card-1' }),
            ),
        )
        expect(apiService.listUserThemeSongs).toHaveBeenLastCalledWith(
            expect.objectContaining({ targetType: 'character', targetId: 'card-1' }),
        )
        // The picker trigger now shows the picked card.
        expect(screen.getByTestId('card-picker-trigger')).toHaveTextContent('Lyra')
    })

    it('deletes an image after confirm and removes its tile', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')

        fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(apiService.deleteImageAsset).toHaveBeenCalledWith('img-1'))
        await waitFor(() => expect(screen.queryByTestId('media-image-tile')).not.toBeInTheDocument())
        // The theme stays.
        expect(screen.getByTestId('media-theme-card')).toBeInTheDocument()
    })

    it('downloads a theme as a file named after the song', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-theme-card')

        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            blob: async () => new Blob(['audio']),
        }) as unknown as Response)
        const createObjectURL = vi.fn(() => 'blob:dl')
        const revokeObjectURL = vi.fn()
        // Direct assignment (restored below) — vi.unstubAllGlobals would also
        // wipe the suite-wide IntersectionObserver stub from src/test/setup.ts.
        const originalFetch = globalThis.fetch
        const originalCreate = URL.createObjectURL
        const originalRevoke = URL.revokeObjectURL
        globalThis.fetch = fetchMock as unknown as typeof fetch
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = revokeObjectURL
        let downloadName: string | null = null
        const click = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function (this: HTMLAnchorElement) {
                downloadName = this.getAttribute('download')
            })

        try {
            fireEvent.click(screen.getByRole('button', { name: 'Download theme' }))

            await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
            expect(fetchMock).toHaveBeenCalledWith('/generated-audio/1.mp3')
            expect(downloadName).toBe('Ember-Hymn.mp3')
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:dl')
        } finally {
            click.mockRestore()
            globalThis.fetch = originalFetch
            URL.createObjectURL = originalCreate
            URL.revokeObjectURL = originalRevoke
        }
    })

    it('deletes a theme via its own endpoint', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-theme-card')

        fireEvent.click(screen.getByRole('button', { name: 'Delete theme' }))
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(apiService.deleteThemeSongAsset).toHaveBeenCalledWith('theme-1'))
        await waitFor(() => expect(screen.queryByTestId('media-theme-card')).not.toBeInTheDocument())
    })

    it('opens the lightbox when an image tile is clicked', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')

        fireEvent.click(screen.getByRole('button', { name: /View image .* full size/ }))

        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })

    it('shows filtered empty-state copy with a Clear filters action', async () => {
        vi.mocked(apiService.listImageJobs).mockResolvedValue({ items: [], limit: 24, offset: 0, next_offset: null })
        vi.mocked(apiService.listUserThemeSongs).mockResolvedValue({
            items: [],
            limit: 24,
            offset: 0,
            next_offset: null,
        })
        render(<MediaGalleryPage />)
        await waitFor(() => expect(screen.getByText('No media yet')).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('card-type-filter-world'))
        await waitFor(() => expect(screen.getByText('No media for your worlds yet')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
        await waitFor(() => expect(screen.getByText('No media yet')).toBeInTheDocument())
    })

    it('surfaces a load error with Retry', async () => {
        vi.mocked(apiService.listImageJobs).mockRejectedValueOnce(new Error('network down'))
        render(<MediaGalleryPage />)

        expect(await screen.findByRole('alert')).toHaveTextContent('network down')

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
        expect(await screen.findByTestId('media-image-tile')).toBeInTheDocument()
    })
})
