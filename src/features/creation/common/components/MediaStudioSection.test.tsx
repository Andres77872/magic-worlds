import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MediaStudioSection, type MediaStudioSectionProps } from './MediaStudioSection'
import { apiService } from '@/infrastructure/api'

// Treat relative URLs as-is so the thumbnail/lightbox render in tests.
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        uploadCardImage: vi.fn(),
        generateCardPortrait: vi.fn(),
        waitForImageJob: vi.fn(),
        listThemeSongs: vi.fn(),
    },
    resolveMediaUrl: (u?: string | null) => (u == null || u === '' ? undefined : u),
}))

const uploadMock = apiService.uploadCardImage as unknown as Mock

function renderPanel(overrides: Partial<MediaStudioSectionProps> = {}) {
    const props: MediaStudioSectionProps = {
        cardType: 'character',
        noun: 'character',
        template: { name: 'Elara' },
        onImageUrl: vi.fn(),
        onThemeSongUrl: vi.fn(),
        ensureSaved: vi.fn(),
        isAuthenticated: true,
        onAuthRequired: vi.fn(),
        layout: 'compact',
        ...overrides,
    }
    return { props, ...render(<MediaStudioSection {...props} />) }
}

afterEach(() => {
    vi.clearAllMocks()
})

describe('MediaStudioSection image actions', () => {
    it('Remove clears the image via onImageUrl(undefined)', () => {
        const onImageUrl = vi.fn()
        renderPanel({ imageUrl: '/portrait.png', onImageUrl })

        fireEvent.click(screen.getByRole('button', { name: /remove image/i }))
        expect(onImageUrl).toHaveBeenCalledWith(undefined)
    })

    it('View opens a lightbox (close affordance appears)', async () => {
        renderPanel({ imageUrl: '/portrait.png' })

        expect(screen.queryByRole('button', { name: /close/i })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: /view image/i }))
        expect(await screen.findByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('Replace uploads the chosen file and sets the returned URL', async () => {
        uploadMock.mockResolvedValue({ asset_id: 'a', url: '/generated-images/uploads/up.png', content_type: 'image/png' })
        const onImageUrl = vi.fn()
        const { container } = renderPanel({ onImageUrl })

        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'p.png', { type: 'image/png' })
        fireEvent.change(input, { target: { files: [file] } })

        await waitFor(() => expect(onImageUrl).toHaveBeenCalledWith('/generated-images/uploads/up.png'))
        expect(uploadMock).toHaveBeenCalledTimes(1)
        expect(uploadMock.mock.calls[0][0]).toBe(file)
    })

    it('rejects a non-image file without calling the API', async () => {
        const onImageUrl = vi.fn()
        const { container } = renderPanel({ onImageUrl })

        const input = container.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
        fireEvent.change(input, { target: { files: [file] } })

        expect(await screen.findByText(/jpeg, png, or webp/i)).toBeInTheDocument()
        expect(uploadMock).not.toHaveBeenCalled()
        expect(onImageUrl).not.toHaveBeenCalled()
    })
})
