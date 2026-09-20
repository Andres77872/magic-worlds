import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MediaStudioSection, type MediaStudioSectionProps } from './MediaStudioSection'
import { apiService } from '@/infrastructure/api'

// Treat relative URLs as-is so the thumbnail/lightbox render in tests.
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        uploadCardImage: vi.fn(),
        generateCardPortrait: vi.fn(),
        waitForImageJob: vi.fn(),
        generateThemeSong: vi.fn(),
        listThemeSongs: vi.fn(),
    },
    resolveMediaUrl: (u?: string | null) => (u == null || u === '' ? undefined : u),
}))

vi.mock('@/app/hooks', () => ({
    useBackgroundTasks: () => ({
        tasks: [],
        registerThemeSongJob: vi.fn(),
    }),
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

describe('MediaStudioSection image generation', () => {
    const genMock = apiService.generateCardPortrait as unknown as Mock
    const waitMock = apiService.waitForImageJob as unknown as Mock

    it('shows still-running copy (not a failure) when the wait deadline passes', async () => {
        genMock.mockResolvedValue({ job_id: 'j1', status: 'pending' })
        // pollUntilTerminal returns the job as-is when the deadline passes first.
        waitMock.mockResolvedValue({ job_id: 'j1', status: 'in_progress' })
        const onImageUrl = vi.fn()
        renderPanel({ onImageUrl })

        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        expect(await screen.findByText(/taking a while/i)).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent(/taking a while/i)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(onImageUrl).not.toHaveBeenCalled()
    })

    it('surfaces the live job stage while waiting', async () => {
        genMock.mockResolvedValue({ job_id: 'j1', status: 'pending' })
        let resolveWait!: (job: unknown) => void
        waitMock.mockImplementation(
            (_id: string, opts: { onUpdate?: (job: unknown) => void }) => {
                opts.onUpdate?.({ job_id: 'j1', status: 'mirroring' })
                return new Promise((res) => {
                    resolveWait = res
                })
            },
        )
        const onImageUrl = vi.fn()
        renderPanel({ onImageUrl })

        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saving image…'))

        resolveWait({ job_id: 'j1', status: 'completed', assets: [{ url: '/img.png' }] })
        await waitFor(() => expect(onImageUrl).toHaveBeenCalledWith('/img.png'))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it.each(['compact', 'full'] as const)('shows immediate feedback and live stages in the %s layout', async (layout) => {
        let resolveStart!: (job: unknown) => void
        let resolveWait!: (job: unknown) => void
        let onUpdate!: (job: unknown) => void
        genMock.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve }))
        waitMock.mockImplementation((_id: string, opts: { onUpdate: (job: unknown) => void }) => {
            onUpdate = opts.onUpdate
            return new Promise((resolve) => { resolveWait = resolve })
        })
        const { props } = renderPanel({ layout })

        fireEvent.click(screen.getByRole('button', { name: /generate (profile image|portrait)/i }))
        expect(screen.getByRole('status')).toHaveTextContent('Starting image generation…')
        expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled()

        await act(async () => { resolveStart({ job_id: 'j1', status: 'pending' }) })
        expect(screen.getByRole('status')).toHaveTextContent('Image queued…')
        act(() => { onUpdate({ job_id: 'j1', status: 'in_progress' }) })
        expect(screen.getByRole('status')).toHaveTextContent('Generating image…')
        await act(async () => { resolveWait({ job_id: 'j1', status: 'completed', assets: [{ url: '/img.png' }] }) })
        expect(props.onImageUrl).toHaveBeenCalledWith('/img.png')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('explains that stopping the wait does not cancel the server job', async () => {
        genMock.mockResolvedValue({ job_id: 'j1', status: 'pending' })
        waitMock.mockImplementation((_id: string, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        }))
        renderPanel()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Image queued…'))
        fireEvent.click(screen.getByRole('button', { name: 'Stop waiting' }))
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/check your gallery/i))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
