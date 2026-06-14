import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioPlaylistProvider } from '@/app/providers/AudioPlaylistProvider'
import { PLAYLIST_STORAGE_KEY } from '@/app/providers/playlistReducer'
import { clearAudioDataCaches } from '@/ui/components/audio'
import { GalleryCard } from './GalleryCard'

function renderWithPlaylist(ui: React.ReactNode) {
    return render(<AudioPlaylistProvider>{ui}</AudioPlaylistProvider>)
}

beforeEach(() => {
    clearAudioDataCaches()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
            ok: true,
            status: 200,
            blob: async () => new Blob(['audio']),
        }) as unknown as Response),
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:theme'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.removeItem(PLAYLIST_STORAGE_KEY)
})

describe('GalleryCard', () => {
    it('does not trigger the card action when a footer action is clicked', () => {
        const onCardClick = vi.fn()
        const onFooterClick = vi.fn()
        renderWithPlaylist(
            <GalleryCard
                title="Lyra Dawnwhisper"
                onClick={onCardClick}
                footer={<button type="button" onClick={onFooterClick}>Chat</button>}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

        expect(onFooterClick).toHaveBeenCalledTimes(1)
        expect(onCardClick).not.toHaveBeenCalled()
    })

    it('downloads a theme from the context menu', async () => {
        let downloadName: string | null = null
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            downloadName = this.getAttribute('download')
        })
        renderWithPlaylist(<GalleryCard title="Lyra Dawnwhisper" themeSongUrl="https://x/lyra.mp3" />)

        fireEvent.contextMenu(screen.getByTestId('gallery-card'), { clientX: 24, clientY: 24 })
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Download theme' }))

        await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
        expect(downloadName).toBe('Lyra-Dawnwhisper.mp3')
    })
})
