import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'

const openLoginModal = vi.fn()
let authed = true
const MockApiError = vi.hoisted(() => class extends Error {
    status: number
    code?: string

    constructor(status: number, message: string, metadata: { code?: string } = {}) {
        super(message)
        this.status = status
        this.code = metadata.code
    }
})

vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
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
    ApiError: MockApiError,
    apiService: {
        listImageJobs: vi.fn(),
        listUserThemeSongs: vi.fn(),
        listWorkspaceMedia: vi.fn(),
        listLibraryCards: vi.fn(),
        deleteImageAsset: vi.fn().mockResolvedValue(undefined),
        deleteThemeSongAsset: vi.fn().mockResolvedValue(undefined),
        fetchProtectedMediaBlob: vi.fn().mockResolvedValue(new Blob(['media'], { type: 'image/jpeg' })),
        getCharacters: vi.fn().mockResolvedValue([]),
        getWorlds: vi.fn().mockResolvedValue([]),
        getItems: vi.fn().mockResolvedValue([]),
        getAdventureTemplates: vi.fn().mockResolvedValue([]),
    },
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

import type { ImageJobPublic, ThemeSongJobPublic, WorkspaceMediaItem, WorkspaceMediaQuery } from '@/shared'
import { ApiError, apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { clearAudioDataCaches } from '@/ui/components/audio'
import { MediaGalleryPage } from './MediaGalleryPage'

let workspace: WorkspaceTestState

function Wrapper({ children }: { children: ReactNode }) {
    return <WorkspaceTestProvider state={workspace}>{children}</WorkspaceTestProvider>
}

function render(ui: ReactElement) {
    return rtlRender(ui, { wrapper: Wrapper })
}

/** Workspace discovery: the media associations of the committed workspace (no card tag, prompt or date). */
const IMAGE_MEDIA: WorkspaceMediaItem = {
    media_kind: 'image',
    asset_id: 'img-1',
    job_id: 'job-i1',
    organization: { workspace_id: TEST_WORKSPACE_ID },
    asset: { asset_id: 'img-1', url: '/generated-images/1.jpeg', content_type: 'image/jpeg' },
}

const THEME_MEDIA: WorkspaceMediaItem = {
    media_kind: 'theme_song',
    asset_id: 'theme-1',
    job_id: 'job-t1',
    organization: { workspace_id: TEST_WORKSPACE_ID },
    asset: { asset_id: 'theme-1', url: '/generated-audio/1.mp3', content_type: 'audio/mpeg', duration_ms: 95_000, output_format: 'mp3' },
}

function serveWorkspaceMedia(image: WorkspaceMediaItem[], themes: WorkspaceMediaItem[]) {
    vi.mocked(apiService.listWorkspaceMedia).mockImplementation(async (_workspaceId: string, query: WorkspaceMediaQuery = {}) => {
        const items = query.media_kind === 'theme_song' ? themes : image
        return { items, total: items.length, limit: 24, offset: query.offset ?? 0 }
    })
}

/** Card-filtered views read the job histories. */
async function filterByCardType(type: 'character' | 'world') {
    fireEvent.click(screen.getByTestId(`card-type-filter-${type}`))
    await waitFor(() => expect(apiService.listImageJobs).toHaveBeenCalled())
}

const IMAGE_JOB: ImageJobPublic = {
    job_id: 'job-i1',
    status: 'completed',
    model_alias: 'text_to_image_qwen',
    generation_prompt: 'Image-only illustration of Lyra beneath violet rain, candlelit and painterly.',
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
    model_alias: 'minimax_music_3',
    status_url: '',
    result_url: '',
    lyrics: { source: 'writer', lyrics_sha256: 'a'.repeat(64), lyrics_length_chars: 80 },
    assets: [
        {
            asset_id: 'theme-1',
            url: '/generated-audio/1.mp3',
            content_type: 'audio/mpeg',
            file_size_bytes: 1,
            duration_ms: 95_000,
            output_format: 'mp3',
        },
    ],
    created_at: '2026-06-10T09:00:00',
    updated_at: '2026-06-10T09:00:00',
}

function renderSpanish(ui: ReactElement) {
    const localI18n = i18n.cloneInstance({ lng: 'es' })
    return render(<I18nextProvider i18n={localI18n}>{ui}</I18nextProvider>)
}

describe('MediaGalleryPage', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        authed = true
        vi.clearAllMocks()
        workspace = createWorkspaceTestState({ api: apiService })
        serveWorkspaceMedia([IMAGE_MEDIA], [THEME_MEDIA])
        clearAudioDataCaches()
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:protected-media'), revokeObjectURL: vi.fn() })
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

    it("renders the committed workspace's media with both renderers", async () => {
        render(<MediaGalleryPage />)

        expect(await screen.findByTestId('media-image-tile')).toBeInTheDocument()
        expect(screen.getByTestId('media-theme-card')).toBeInTheDocument()
        // Discovery items carry no card tag; an untitled theme gets the fallback title.
        expect(screen.getAllByText('Theme song').length).toBeGreaterThan(0)
        expect(screen.queryByTestId('media-card-badge')).not.toBeInTheDocument()
        expect(screen.getByText('1:35')).toBeInTheDocument()
        expect(apiService.listWorkspaceMedia).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { media_kind: 'image', limit: 24, offset: 0 }, )
        expect(apiService.listWorkspaceMedia).toHaveBeenCalledWith(TEST_WORKSPACE_ID, { media_kind: 'theme_song', limit: 24, offset: 0 })
        expect(apiService.listImageJobs).not.toHaveBeenCalled()

        const grid = screen.getByTestId('card-grid-list')
        const tiles = grid.querySelectorAll('[data-testid="media-image-tile"], [data-testid="media-theme-card"]')
        expect(tiles[0].getAttribute('data-testid')).toBe('media-image-tile')
    })

    it('renders a card-type view from the job histories with card tags, newest first', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')

        await filterByCardType('world')

        await waitFor(() => expect(screen.getAllByText('Rivendell')).toHaveLength(2))
        expect(apiService.listImageJobs).toHaveBeenLastCalledWith(expect.objectContaining({ cardType: 'world' }))
        expect(apiService.listUserThemeSongs).toHaveBeenLastCalledWith(expect.objectContaining({ targetType: 'world' }))
    })

    it('closes the lightbox and refetches the new workspace from offset 0 after a switch', async () => {
        const { rerender } = render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        fireEvent.click(screen.getByRole('button', { name: /View image full size/ }))
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

        serveWorkspaceMedia([], [])
        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(<MediaGalleryPage />)

        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
        await waitFor(() => expect(apiService.listWorkspaceMedia).toHaveBeenCalledWith(OTHER_WORKSPACE_ID, { media_kind: 'image', limit: 24, offset: 0 }))
        expect(await screen.findByText(i18n.t('mediaGallery.empty.noMedia'))).toBeInTheDocument()
    })

    it('renders signed-out without prompting login or fetching protected media lists', async () => {
        authed = false

        render(<MediaGalleryPage />)

        expect(screen.getByRole('heading', { name: 'Media' })).toBeInTheDocument()
        expect(await screen.findByText(i18n.t('mediaGallery.empty.noMedia'))).toBeInTheDocument()
        expect(apiService.listImageJobs).not.toHaveBeenCalled()
        expect(apiService.listUserThemeSongs).not.toHaveBeenCalled()
        expect(apiService.listWorkspaceMedia).not.toHaveBeenCalled()
        expect(openLoginModal).not.toHaveBeenCalled()
    })

    it('media-type chips refetch only the matching source', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        vi.mocked(apiService.listWorkspaceMedia).mockClear()

        fireEvent.click(screen.getByTestId('media-filter-themes'))

        await waitFor(() => expect(apiService.listWorkspaceMedia).toHaveBeenCalled())
        expect(apiService.listWorkspaceMedia).not.toHaveBeenCalledWith(TEST_WORKSPACE_ID, expect.objectContaining({ media_kind: 'image' }))
        await waitFor(() => expect(screen.queryByTestId('media-image-tile')).not.toBeInTheDocument())
    })

    it("clicking a tile's card badge filters to that card and syncs the type chip", async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        await filterByCardType('character')
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

        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.deleteImage') }))
        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.actions.delete') }))

        await waitFor(() => expect(apiService.deleteImageAsset).toHaveBeenCalledWith('img-1'))
        await waitFor(() => expect(screen.queryByTestId('media-image-tile')).not.toBeInTheDocument())
        // The theme stays.
        expect(screen.getByTestId('media-theme-card')).toBeInTheDocument()
    })

    it('keeps a referenced asset visible when deletion returns asset_in_use', async () => {
        vi.mocked(apiService.deleteImageAsset).mockRejectedValueOnce(
            new ApiError(409, 'This asset is still referenced by a card version.', { code: 'asset_in_use' }),
        )
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')

        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.deleteImage') }))
        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.actions.delete') }))

        expect(await screen.findByRole('alert')).toHaveTextContent('This asset is still referenced by a card version.')
        expect(screen.getByTestId('media-image-tile')).toBeInTheDocument()
    })

    it('downloads a theme as a file named after the song', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-theme-card')
        await filterByCardType('world')
        await waitFor(() => expect(screen.getAllByText('Rivendell')).toHaveLength(2))

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
            fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.downloadTheme') }))

            await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
            expect(fetchMock).toHaveBeenCalledWith('/generated-audio/1.mp3')
            expect(downloadName).toBe('Rivendell.mp3')
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:dl')
        } finally {
            click.mockRestore()
            globalThis.fetch = originalFetch
            URL.createObjectURL = originalCreate
            URL.revokeObjectURL = originalRevoke
        }
    })

    it('keeps viewing but disables deletes while the workspace is archived', async () => {
        workspace = createWorkspaceTestState({
            api: apiService,
            workspaces: [testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' })],
        })
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        await screen.findByTestId('media-theme-card')

        expect(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.deleteImage') })).toBeDisabled()
        expect(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.deleteTheme') })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'View image full size' }))
        expect(screen.getByTestId('media-image-prompt-panel')).toBeInTheDocument()
        expect(apiService.deleteImageAsset).not.toHaveBeenCalled()
        expect(apiService.deleteThemeSongAsset).not.toHaveBeenCalled()
    })

    it('deletes a theme via its own endpoint', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-theme-card')

        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.tile.deleteTheme') }))
        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.actions.delete') }))

        await waitFor(() => expect(apiService.deleteThemeSongAsset).toHaveBeenCalledWith('theme-1'))
        await waitFor(() => expect(screen.queryByTestId('media-theme-card')).not.toBeInTheDocument())
    })

    it('opens the lightbox without a prompt for a workspace discovery image', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')

        fireEvent.click(screen.getByRole('button', { name: 'View image full size' }))

        expect(screen.getByTestId('media-image-prompt-panel')).toHaveTextContent(i18n.t('mediaGallery.lightbox.promptUnavailable'))
    })

    it('opens the lightbox with the recorded prompt for a card-filtered image', async () => {
        render(<MediaGalleryPage />)
        await screen.findByTestId('media-image-tile')
        await filterByCardType('character')
        await screen.findAllByTestId('media-card-badge')

        fireEvent.click(screen.getByRole('button', { name: /View image .* full size/ }))

        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
        expect(screen.getByTestId('media-image-prompt-panel')).toHaveTextContent('Prompt')
        expect(screen.getByText('Image-only illustration of Lyra beneath violet rain, candlelit and painterly.')).toBeInTheDocument()
        expect(screen.queryByText('text_to_image_qwen')).not.toBeInTheDocument()
    })

    it('shows filtered empty-state copy with a Clear filters action', async () => {
        serveWorkspaceMedia([], [])
        vi.mocked(apiService.listImageJobs).mockResolvedValue({ items: [], limit: 24, offset: 0, next_offset: null })
        vi.mocked(apiService.listUserThemeSongs).mockResolvedValue({
            items: [],
            limit: 24,
            offset: 0,
            next_offset: null,
        })
        render(<MediaGalleryPage />)
        await waitFor(() => expect(screen.getByText(i18n.t('mediaGallery.empty.noMedia'))).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('card-type-filter-world'))
        await waitFor(() =>
            expect(
                screen.getByText(i18n.t('mediaGallery.empty.noMediaForType', {
                    type: i18n.t('mediaGallery.empty.type.world'),
                })),
            ).toBeInTheDocument(),
        )

        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.actions.clearFilters') }))
        await waitFor(() => expect(screen.getByText(i18n.t('mediaGallery.empty.noMedia'))).toBeInTheDocument())
    })

    it('renders media gallery chrome and empty states in Spanish', async () => {
        serveWorkspaceMedia([], [])
        vi.mocked(apiService.listImageJobs).mockResolvedValue({ items: [], limit: 24, offset: 0, next_offset: null })
        vi.mocked(apiService.listUserThemeSongs).mockResolvedValue({
            items: [],
            limit: 24,
            offset: 0,
            next_offset: null,
        })

        renderSpanish(<MediaGalleryPage />)

        expect(screen.getByRole('heading', { name: 'Medios' })).toBeInTheDocument()
        expect(screen.getByRole('group', { name: 'Tipo de medio' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Todo' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Imágenes' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Temas' })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('Aún no hay medios')).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('card-type-filter-world'))
        await waitFor(() => expect(screen.getByText('Aún no hay medios para tus mundos')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
    })

    it('renders media item actions in Spanish', async () => {
        renderSpanish(<MediaGalleryPage />)

        await screen.findByTestId('media-image-tile')
        expect(screen.getByRole('button', { name: 'Eliminar imagen' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Descargar tema' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Eliminar tema' })).toBeInTheDocument()
    })

    it('surfaces a load error with Retry', async () => {
        vi.mocked(apiService.listWorkspaceMedia).mockRejectedValueOnce(new Error('network down'))
        render(<MediaGalleryPage />)

        expect(await screen.findByRole('alert')).toHaveTextContent('network down')

        fireEvent.click(screen.getByRole('button', { name: i18n.t('mediaGallery.actions.retry') }))
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
        expect(await screen.findByTestId('media-image-tile')).toBeInTheDocument()
    })
})
