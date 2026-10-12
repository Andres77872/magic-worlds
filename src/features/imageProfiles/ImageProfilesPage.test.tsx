import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { AdminImageProfilesPage, ImageProfilesPage } from './ImageProfilesPage'
import { geminiProfile, gptProfile, imageCatalog, kreaProfile, personalProfile, rootList, userList } from './imageProfileFixtures'

const mocks = vi.hoisted(() => ({
    root: false, authenticated: true, setPage: vi.fn(), login: vi.fn(),
    catalog: vi.fn(), profiles: vi.fn(), systemProfiles: vi.fn(), preference: vi.fn(), create: vi.fn(), update: vi.fn(),
    archive: vi.fn(), globalDefault: vi.fn(), starter: vi.fn(),
}))
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: mocks.authenticated, user: { user_type: mocks.root ? 'root' : 'consumer' }, openLoginModal: mocks.login }),
    useNavigation: () => ({ setPage: mocks.setPage }),
}))
vi.mock('@/infrastructure/api', async importOriginal => ({
    ...await importOriginal<typeof import('@/infrastructure/api')>(),
    apiService: {
        getImageCatalog: mocks.catalog, getImageProfiles: mocks.profiles, getSystemImageProfiles: mocks.systemProfiles,
        setImagePreference: mocks.preference, createImageProfile: mocks.create, updateImageProfile: mocks.update,
        archiveImageProfile: mocks.archive, setGlobalImageDefault: mocks.globalDefault, seedStarterImageProfiles: mocks.starter,
    },
}))

beforeEach(() => {
    vi.clearAllMocks(); mocks.root = false; mocks.authenticated = true
    mocks.catalog.mockResolvedValue(imageCatalog)
    mocks.profiles.mockResolvedValue(userList)
    mocks.systemProfiles.mockResolvedValue(rootList)
})

it('requires root before loading the root console', () => {
    render(<AdminImageProfilesPage />)
    expect(screen.getByText('This console requires root access.')).toBeInTheDocument()
    expect(mocks.systemProfiles).not.toHaveBeenCalled(); expect(mocks.catalog).not.toHaveBeenCalled()
})

it('asks a signed-out visitor to sign in', () => {
    mocks.authenticated = false
    render(<ImageProfilesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(mocks.login).toHaveBeenCalled(); expect(mocks.profiles).not.toHaveBeenCalled()
})

it('lets root set the global default and names the missing server key', async () => {
    mocks.root = true
    mocks.globalDefault.mockResolvedValue({ ...rootList, system_default_profile_id: gptProfile.profile_id })
    render(<AdminImageProfilesPage />)

    expect(await screen.findByText(/has no OpenRouter key\. Set OPENROUTER_API_KEY/)).toBeInTheDocument()
    // Only an active, available profile that is not the default yet offers it (GPT here).
    fireEvent.click(screen.getByRole('button', { name: 'Make global default' }))

    await waitFor(() => expect(mocks.globalDefault).toHaveBeenCalledWith(gptProfile.profile_id))
    expect(await screen.findByText('Default image model updated.')).toBeInTheDocument()
})

it('does not offer an unavailable profile as the global default', async () => {
    mocks.root = true
    render(<AdminImageProfilesPage />)

    fireEvent.click(await screen.findByRole('combobox', { name: 'Global default' }))
    // Gemini runs on OpenRouter, which has no app key here.
    const unavailable = await screen.findByRole('option', { name: /Gemini Flash Image/ })
    expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    expect(unavailable).toHaveTextContent('Unavailable')
    expect(screen.getByRole('option', { name: /GPT Image 2.5 Flare/ })).not.toHaveAttribute('aria-disabled')
    fireEvent.click(unavailable)
    expect(mocks.globalDefault).not.toHaveBeenCalled()
})

it('does not warn about a missing key no active app profile needs', async () => {
    mocks.root = true
    mocks.systemProfiles.mockResolvedValue({ ...rootList, items: rootList.items.filter(profile => profile.provider === 'fal') })
    render(<AdminImageProfilesPage />)

    expect(await screen.findByRole('heading', { name: kreaProfile.name })).toBeInTheDocument()
    expect(screen.queryByText(/has no OpenRouter key/)).not.toBeInTheDocument()
})

it('creates an app profile with a price from the catalog', async () => {
    mocks.root = true
    mocks.create.mockResolvedValue({ ...kreaProfile, profile_id: 'new-profile', name: 'Krea 2 Turbo' })
    render(<AdminImageProfilesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New profile' }))
    expect(await screen.findByLabelText('Credits per image')).toHaveValue(1)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ name: 'Krea 2 Turbo', description: '', provider: 'fal',
        model_id: 'fal-ai/krea-2/turbo', settings: {}, provider_options: {}, credit_cost: 1 }, true))
})

it('explains why the global default cannot be archived', async () => {
    mocks.root = true
    mocks.archive.mockRejectedValue(new ApiError(409, 'IMAGE_PROFILE_IS_DEFAULT', { code: 'IMAGE_PROFILE_IS_DEFAULT' }))
    render(<AdminImageProfilesPage />)

    const archiveButtons = await screen.findAllByRole('button', { name: 'Archive' })
    fireEvent.click(archiveButtons.find(button => !button.hasAttribute('disabled'))!)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }))

    expect(await screen.findByText(/Make another profile the default first/)).toBeInTheDocument()
    expect(mocks.archive).toHaveBeenCalledWith(gptProfile.profile_id, gptProfile.row_version, true)
})

it('lets a user fall back to the app default and never offers to edit app profiles', async () => {
    mocks.preference.mockResolvedValue({ ...userList, user_default_profile_id: null, effective_default_profile_id: kreaProfile.profile_id })
    render(<ImageProfilesPage />)

    expect(await screen.findByRole('heading', { name: personalProfile.name })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
    expect(screen.queryByText(/root console/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Default image model' }))
    fireEvent.click(await screen.findByRole('option', { name: /App default · Krea 2 Turbo/ }))
    await waitFor(() => expect(mocks.preference).toHaveBeenCalledWith(null))
})

it('sends a personal profile’s name and description trimmed', async () => {
    mocks.create.mockResolvedValue({ ...personalProfile, profile_id: 'new-profile', name: 'My Flux' })
    render(<ImageProfilesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New profile' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'My Flux ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Moody covers.\nOn my own key. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'My Flux', description: 'Moody covers.\nOn my own key.' }), false))
})

it('shows the app default when the personal default can no longer run', async () => {
    // The server skips a dead personal default (here an unavailable OpenRouter profile) and falls back.
    mocks.profiles.mockResolvedValue({ ...userList, user_default_profile_id: geminiProfile.profile_id, effective_default_profile_id: kreaProfile.profile_id })
    render(<ImageProfilesPage />)

    expect(await screen.findByRole('combobox', { name: 'Default image model' })).toHaveTextContent('App default · Krea 2 Turbo')
    expect(screen.getByText('Global default')).toBeInTheDocument()
    expect(screen.queryByText('Your default')).not.toBeInTheDocument()
})

it('links root from the user page to the root console', async () => {
    mocks.root = true
    render(<ImageProfilesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open image profiles' }))
    expect(mocks.setPage).toHaveBeenCalledWith('admin-image-profiles')
})
