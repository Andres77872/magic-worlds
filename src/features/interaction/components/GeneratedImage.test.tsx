import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthenticatedMediaUrl } from '@/infrastructure/api/useAuthenticatedMediaUrl'
import { GeneratedImage } from './GeneratedImage'

vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl', () => ({ useAuthenticatedMediaUrl: vi.fn() }))

beforeEach(() => {
    vi.mocked(useAuthenticatedMediaUrl).mockImplementation((url) => ({ src: url ?? undefined, loading: false, error: null }))
})

describe('GeneratedImage lifecycle feedback', () => {
    it('announces real stages and keeps loading feedback until the image paints', () => {
        const { rerender } = render(<GeneratedImage status="pending" />)
        expect(screen.getByRole('status')).toHaveTextContent('Image queued…')
        expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

        rerender(<GeneratedImage status="in_progress" />)
        expect(screen.getByRole('status')).toHaveTextContent('Generating image…')
        expect(screen.getByRole('status')).toHaveTextContent('You can keep chatting')
        rerender(<GeneratedImage status="mirroring" />)
        expect(screen.getByRole('status')).toHaveTextContent('Saving image…')

        vi.mocked(useAuthenticatedMediaUrl).mockReturnValue({ src: undefined, loading: true, error: null })
        rerender(<GeneratedImage status="completed" url="/scene.png" />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading image…')
        expect(screen.queryByRole('img')).not.toBeInTheDocument()

        vi.mocked(useAuthenticatedMediaUrl).mockReturnValue({ src: '/scene.png', loading: false, error: null })
        rerender(<GeneratedImage status="completed" url="/scene.png" />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading image…')
        fireEvent.load(screen.getByRole('img', { name: 'Generated scene' }))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByRole('img')).toHaveClass('opacity-100')
    })

    it('restarts loading feedback when the image URL changes', () => {
        const { rerender } = render(<GeneratedImage status="completed" url="/first.png" />)
        fireEvent.load(screen.getByRole('img'))
        rerender(<GeneratedImage status="completed" url="/second.png" />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading image…')
    })

    it('replaces loading feedback with a useful error when image decoding fails', () => {
        render(<GeneratedImage status="completed" url="/broken.png" />)
        fireEvent.error(screen.getByRole('img'))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Refresh the page to try again.')
    })

    it('reports a download error without claiming generation failed', () => {
        vi.mocked(useAuthenticatedMediaUrl).mockReturnValue({ src: undefined, loading: false, error: new Error('Download failed') })
        render(<GeneratedImage status="completed" url="/scene.png" />)
        expect(screen.getByRole('alert')).toHaveTextContent('The image could not be loaded.')
    })

    it('clears pending feedback on failure and hides unavailable generation', () => {
        const { rerender } = render(<GeneratedImage status="in_progress" />)
        rerender(<GeneratedImage status="failed" errorDetail="Please try again later." />)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Please try again later.')
        rerender(<GeneratedImage status="unavailable" />)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
