import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { MediaStudioSection, type MediaStudioSectionProps } from './MediaStudioSection'
import { apiService } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { gptProfile, kreaProfile, personalProfile, userList } from '@/features/imageProfiles/imageProfileFixtures'

// Personal provider keys only travel over HTTPS.
vi.mock('@/infrastructure/api/baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))

// Treat relative URLs as-is so the thumbnail/lightbox render in tests.
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        uploadCardImage: vi.fn(),
        generateCardPortrait: vi.fn(),
        getImageProfiles: vi.fn(async () => ({ items: [], system_default_profile_id: null, user_default_profile_id: null, effective_default_profile_id: null })),
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

        // Clicked before the image model list arrived: busy at once, the job starts once it is in.
        fireEvent.click(screen.getByRole('button', { name: /generate (profile image|portrait)/i }))
        expect(screen.getByRole('status')).toHaveTextContent('Starting image generation…')
        expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled()
        await waitFor(() => expect(genMock).toHaveBeenCalledTimes(1))
        expect(screen.getByRole('status')).toHaveTextContent('Starting image generation…')

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

describe('MediaStudioSection image model', () => {
    const genMock = apiService.generateCardPortrait as unknown as Mock
    const profilesMock = apiService.getImageProfiles as unknown as Mock
    const waitMock = apiService.waitForImageJob as unknown as Mock
    const KEY = 'FAKE_FAL_KEY_CANARY'
    const token = `header.${btoa(JSON.stringify({ project_hash: 'project-one' }))}.signature`

    beforeEach(() => { authSession.continueSignedOut(); authSession.authenticate('alice', token) })
    afterEach(() => { imageCredentialSession.clear(); authSession.continueSignedOut() })

    it('sends the default app profile and no key', async () => {
        profilesMock.mockResolvedValueOnce({ ...userList, user_default_profile_id: null, effective_default_profile_id: kreaProfile.profile_id })
        genMock.mockResolvedValue({ job_id: 'j1', status: 'completed', assets: [{ url: '/img.png' }] })
        const { props } = renderPanel()

        expect(await screen.findByText('Krea 2 Turbo (default)')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        await waitFor(() => expect(props.onImageUrl).toHaveBeenCalledWith('/img.png'))
        expect(genMock.mock.calls[0][0]).toMatchObject({ image_profile_id: kreaProfile.profile_id })
        expect(genMock.mock.calls[0][0]).not.toHaveProperty('credentials')
    })

    it('asks for the personal key first, then sends it with that one request', async () => {
        profilesMock.mockResolvedValueOnce(userList)
        genMock.mockResolvedValue({ job_id: 'j1', status: 'completed', assets: [{ url: '/img.png' }] })
        const { props } = renderPanel()

        expect(await screen.findByText('My Sana (default)')).toBeInTheDocument()
        expect(screen.getByText('You will be asked for your fal.ai key.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        expect(await screen.findByRole('dialog', { name: 'Your fal.ai key' })).toBeInTheDocument()
        expect(genMock).not.toHaveBeenCalled()
        fireEvent.change(screen.getByLabelText('API key'), { target: { value: KEY } })
        fireEvent.click(screen.getByRole('button', { name: 'Use key' }))

        await waitFor(() => expect(props.onImageUrl).toHaveBeenCalledWith('/img.png'))
        expect(genMock.mock.calls[0][0]).toMatchObject({ image_profile_id: personalProfile.profile_id, credentials: { api_key: KEY } })
        expect(screen.getByText('Your fal.ai key is set for this tab.')).toBeInTheDocument()
        expect(JSON.stringify(localStorage)).not.toContain(KEY)
    })

    it('drops a rejected personal key so the next attempt asks again', async () => {
        imageCredentialSession.remember('fal', KEY)
        profilesMock.mockResolvedValueOnce(userList)
        // A personal fal key runs directly: the job is accepted, then fails while waiting.
        genMock.mockResolvedValue({ job_id: 'j1', status: 'in_progress' })
        waitMock.mockResolvedValue({ job_id: 'j1', status: 'failed',
            error: { category: 'provider_completion', detail: 'The image provider rejected the API key.', code: 'provider_credentials_rejected' } })
        renderPanel()

        expect(await screen.findByText('Your fal.ai key is set for this tab.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent('The provider rejected your key.')
        expect(imageCredentialSession.has('fal')).toBe(false)
        expect(screen.getByText('You will be asked for your fal.ai key.')).toBeInTheDocument()
    })

    const appDefault = { ...userList, user_default_profile_id: null, effective_default_profile_id: kreaProfile.profile_id }
    const apiError = (status: number, message: string, category: string, code: string) => Object.assign(new Error(message), { status, category, code })

    it.each(['image_profile_unavailable', 'IMAGE_PROFILE_NOT_FOUND'])('explains a %s profile and reloads the picker', async (code) => {
        profilesMock.mockResolvedValueOnce(appDefault)
        // Archived elsewhere in the meantime: the reload no longer lists it.
        profilesMock.mockResolvedValueOnce({ ...appDefault, items: appDefault.items.filter(item => item.profile_id !== gptProfile.profile_id) })
        genMock.mockRejectedValue(apiError(404, 'Image resource not found.', 'not_found', code))
        renderPanel()

        fireEvent.click(await screen.findByRole('combobox', { name: 'Image model' }))
        fireEvent.click(await screen.findByRole('option', { name: /GPT Image 2.5 Flare/ }))
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(code.toUpperCase() === 'IMAGE_PROFILE_UNAVAILABLE'
            ? 'This profile is not available right now.' : 'This profile no longer exists.')
        expect(alert).not.toHaveTextContent(/save the card first/i)
        expect(genMock.mock.calls[0][0]).toMatchObject({ image_profile_id: gptProfile.profile_id })
        await waitFor(() => expect(profilesMock).toHaveBeenCalledTimes(2))
        expect(await screen.findByText('Krea 2 Turbo (default)')).toBeInTheDocument()
    })

    it('loads a failed list before generating, so a personal default asks for its key', async () => {
        profilesMock.mockRejectedValueOnce(new Error('offline'))
        profilesMock.mockResolvedValueOnce(userList)
        renderPanel()

        expect(await screen.findByText('Image models could not be loaded.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        expect(await screen.findByRole('dialog', { name: 'Your fal.ai key' })).toBeInTheDocument()
        expect(genMock).not.toHaveBeenCalled()
        expect(screen.getByText('My Sana (default)')).toBeInTheDocument()
    })

    it('asks for the key when the server ran a personal default the list did not know', async () => {
        profilesMock.mockRejectedValueOnce(new Error('offline'))
        profilesMock.mockRejectedValueOnce(new Error('offline'))
        profilesMock.mockResolvedValueOnce(userList)
        genMock.mockRejectedValueOnce(apiError(422, 'This profile runs on your own provider key; add the key before generating.',
            'validation', 'provider_credentials_missing'))
        genMock.mockResolvedValueOnce({ job_id: 'j1', status: 'completed', assets: [{ url: '/img.png' }] })
        const { props } = renderPanel()

        expect(await screen.findByText('Image models could not be loaded.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))

        expect(await screen.findByRole('dialog', { name: 'Your fal.ai key' })).toBeInTheDocument()
        // Still unknown when it was sent: the server resolved the default.
        expect(genMock.mock.calls[0][0]).not.toHaveProperty('image_profile_id')
        fireEvent.change(screen.getByLabelText('API key'), { target: { value: KEY } })
        fireEvent.click(screen.getByRole('button', { name: 'Use key' }))

        await waitFor(() => expect(props.onImageUrl).toHaveBeenCalledWith('/img.png'))
        expect(genMock.mock.calls[1][0]).toMatchObject({ image_profile_id: personalProfile.profile_id, credentials: { api_key: KEY } })
    })

    it('offers a retry when the list could not be loaded', async () => {
        profilesMock.mockRejectedValueOnce(new Error('offline'))
        profilesMock.mockResolvedValueOnce(appDefault)
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
        expect(await screen.findByText('Krea 2 Turbo (default)')).toBeInTheDocument()
        expect(screen.queryByText('Image models could not be loaded.')).not.toBeInTheDocument()
    })

    it('shows a failed job’s own detail', async () => {
        profilesMock.mockResolvedValueOnce({ ...userList, user_default_profile_id: null, effective_default_profile_id: kreaProfile.profile_id })
        genMock.mockResolvedValue({ job_id: 'j1', status: 'pending' })
        waitMock.mockResolvedValue({ job_id: 'j1', status: 'failed',
            error: { category: 'provider_completion', detail: 'The image provider rejected the request settings.', code: 'provider_request_rejected' } })
        renderPanel()

        expect(await screen.findByText('Krea 2 Turbo (default)')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate profile image/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent('The image provider rejected the request settings.')
    })
})

describe('MediaStudioSection theme generation', () => {
    const themeMock = apiService.generateThemeSong as unknown as Mock
    const listMock = apiService.listThemeSongs as unknown as Mock

    it('sends the default model and no instrumental flag', async () => {
        listMock.mockResolvedValue({ items: [] })
        themeMock.mockResolvedValue({ job_id: 't1', status: 'pending', assets: [] })
        renderPanel({ ensureSaved: vi.fn().mockResolvedValue('card-1'), themeTargetId: 'card-1' })

        fireEvent.click(screen.getByRole('button', { name: /generate theme/i }))

        await waitFor(() => expect(themeMock).toHaveBeenCalledTimes(1))
        expect(themeMock.mock.calls[0][0]).toEqual({
            target_type: 'character',
            target_id: 'card-1',
            description: 'An evocative theme song for Elara.',
            model_alias: 'minimax_music_3',
            instrumental: false,
        })
        expect(await screen.findByText(/composing in tasks/i)).toBeInTheDocument()
    })

    it.each(['compact', 'full'] as const)('forwards the chosen model and instrumental toggle in the %s layout', async (layout) => {
        listMock.mockResolvedValue({ items: [] })
        themeMock.mockResolvedValue({ job_id: 't2', status: 'pending', assets: [] })
        renderPanel({ layout, ensureSaved: vi.fn().mockResolvedValue('card-1'), themeTargetId: 'card-1' })

        fireEvent.click(screen.getByRole('radio', { name: 'ACE-Step' }))
        expect(screen.getByRole('radio', { name: 'ACE-Step' })).toBeChecked()
        expect(screen.getByText(/quick, lighter take/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('switch', { name: /instrumental/i }))
        expect(screen.getByText(/no vocals/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /generate theme/i }))

        await waitFor(() => expect(themeMock).toHaveBeenCalledTimes(1))
        expect(themeMock.mock.calls[0][0]).toMatchObject({ model_alias: 'ace_step', instrumental: true })
    })
})
