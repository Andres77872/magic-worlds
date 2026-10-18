import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { prepareLlmDispatch } from '@/infrastructure/api/llmPreparation'
import { credentialSession } from './credentialSession'
import { LlmFeatureControl } from './LlmFeatureControl'
import { LlmSessionProvider } from './LlmSessionProvider'
import { applicationEffective, applicationProfile, featureFixture, personalEffective, personalProfile } from './llmFeatureFixtures'

const mocks = vi.hoisted(() => ({ features: vi.fn(), profiles: vi.fn(), resolve: vi.fn() }))
vi.mock('@/infrastructure/api/baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
vi.mock('@/infrastructure', () => ({ apiService: { getLlmFeatures: mocks.features, getLlmProfiles: mocks.profiles, resolveLlmProfile: mocks.resolve } }))
vi.mock('@/app/hooks', () => ({ useAuth: () => authSession.getSnapshot() }))
const token = `header.${btoa(JSON.stringify({ project_hash: 'fixture-project' }))}.signature`
const KEY = 'FAKE_FEATURE_SESSION_CANARY'
beforeEach(() => {
    vi.resetAllMocks(); credentialSession.clear(); authSession.continueSignedOut(); authSession.authenticate('alice', token); grantFixtureFeatures(true)
    mocks.features.mockResolvedValue({ features: [featureFixture('novel'), featureFixture('card_assistant'), featureFixture('image_prompt', false)] })
    mocks.profiles.mockResolvedValue({ items: [applicationProfile, personalProfile], total: 2, offset: 0, limit: 25 })
    mocks.resolve.mockImplementation(async (_feature, selection) => selection?.mode === 'profile' && selection.profile_id === personalProfile.profile_id ? personalEffective : applicationEffective)
})
afterEach(() => { credentialSession.clear(); authSession.continueSignedOut() })
function mount(feature: 'novel' | 'image_prompt' = 'novel') {
    return render(<LlmSessionProvider><LlmFeatureControl feature={feature} /></LlmSessionProvider>)
}
/** The control is a compact chip; its details and profile choice live in a popover. */
async function openChip() {
    fireEvent.click(await screen.findByRole('button', { name: /^Profile for / }))
    return screen.findByRole('dialog')
}
async function openChoices() {
    if (!screen.queryByRole('dialog')) await openChip()
    fireEvent.click(await screen.findByRole('button', { name: 'Change profile' }))
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled())
}
function choose(name: string) {
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }))
}

it('previews all resolved roles and inherited payer without enumerating profiles or requesting a key', async () => {
    mount()
    const details = within(await openChip())
    expect(await details.findByText('Fixture writer')).toBeInTheDocument()
    expect(screen.getByText('Fixture metadata model')).toBeInTheDocument()
    expect(screen.getByText('Fixture context model')).toBeInTheDocument()
    expect(screen.getByText('Application recommendation for this feature')).toBeInTheDocument()
    expect(screen.getByText('Uses platform credits')).toBeInTheDocument()
    expect(mocks.profiles).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
})
it('previews a draft-owned selection without replacing it with a session choice and reports only validated public intent', async () => {
    const changed = vi.fn()
    render(<LlmSessionProvider><LlmFeatureControl feature="novel" selection={{ mode: 'profile', profile_id: personalProfile.profile_id }} onSelectionChange={changed} /></LlmSessionProvider>)
    const details = within(await openChip())
    expect(await details.findByText('A provider key will be requested before running.')).toBeInTheDocument()
    expect(mocks.resolve).toHaveBeenCalledWith('novel', { mode: 'profile', profile_id: personalProfile.profile_id })
    expect(changed).not.toHaveBeenCalled()
    await openChoices()
    choose('Use my defaults and application recommendations')
    await waitFor(() => expect(changed).toHaveBeenCalledWith({ mode: 'inherit' }))
    expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
})
it('validates paginated choices on the server and disables incompatible or unpublished profiles', async () => {
    const incompatible = { ...personalProfile, profile_id: '55555555-5555-4555-8555-555555555555', name: 'Chat-only profile' }
    const draft = { ...personalProfile, profile_id: '66666666-6666-4666-8666-666666666666', name: 'Unpublished', status: 'draft', revision_id: null }
    mocks.profiles.mockImplementation(async (_scope, offset) => offset === 0 ? { items: [incompatible, draft], total: 3, limit: 2, offset: 0 } : { items: [personalProfile], total: 3, limit: 2, offset: 2 })
    mocks.resolve.mockImplementation(async (_feature, selection) => {
        if (selection?.profile_id === incompatible.profile_id) throw new ApiError(422, 'PRIVATE PROVIDER DIAGNOSTIC', { code: 'PROFILE_INCOMPATIBLE' })
        return selection?.profile_id === personalProfile.profile_id ? personalEffective : applicationEffective
    })
    mount(); await openChoices()
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /Chat-only profile/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('option', { name: /Unpublished/ })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Load more profiles' }))
    await waitFor(() => expect(mocks.profiles).toHaveBeenCalledWith('available', 2))
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled())
    choose('My storyteller')
    expect(await screen.findByText('A provider key will be requested before running.')).toBeInTheDocument()
    expect(mocks.resolve.mock.calls.some(([, intent]) => intent?.profile_id === draft.profile_id)).toBe(false)
    expect(document.body.textContent).not.toContain('PRIVATE PROVIDER DIAGNOSTIC')
})
it('uses the validated feature choice at dispatch, prompts only then and lets the user forget its key', async () => {
    mount(); await openChoices(); choose('My storyteller')
    await screen.findByText('A provider key will be requested before running.')
    expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
    let prepared!: ReturnType<typeof prepareLlmDispatch>
    act(() => { prepared = prepareLlmDispatch('novel') })
    const input = await screen.findByLabelText('Provider API key')
    fireEvent.change(input, { target: { value: KEY } })
    fireEvent.click(screen.getByRole('button', { name: 'Use for this session' }))
    const materialize = await prepared
    expect(materialize()).toEqual({ selection: { mode: 'profile', profile_id: personalProfile.profile_id }, expected_revision_id: personalEffective.revision_id, credentials: { api_key: KEY } })
    expect(await screen.findByText('Provider key available in this session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Forget this provider key' }))
    await screen.findByText('A provider key will be requested before running.')
    expect(materialize).toThrow('BYOK_CREDENTIAL_REQUIRED')
    expect(document.body.textContent).not.toContain(KEY)
    expect(JSON.stringify(localStorage)).not.toContain(KEY); expect(JSON.stringify(sessionStorage)).not.toContain(KEY)
})
it('keeps a prepared request bound to its original profile and gives explicit caller intent precedence', async () => {
    mount(); await screen.findByText('Fixture writer')
    const original = await prepareLlmDispatch('novel')
    await openChoices(); choose('My storyteller'); await screen.findByText('A provider key will be requested before running.')
    expect(original().selection).toEqual({ mode: 'profile', profile_id: applicationProfile.profile_id })
    const explicit = await prepareLlmDispatch('novel', undefined, { mode: 'inherit' })
    expect(explicit().selection).toEqual({ mode: 'profile', profile_id: applicationProfile.profile_id })
    const otherFeature = await prepareLlmDispatch('card_assistant')
    expect(otherFeature().selection).toEqual({ mode: 'profile', profile_id: applicationProfile.profile_id })
})
it('keeps the old selection after failed validation and suppresses diagnostic text', async () => {
    mount(); await openChoices()
    mocks.resolve.mockImplementation(async (_feature, intent) => {
        if (intent?.profile_id === personalProfile.profile_id) throw new ApiError(422, 'PRIVATE KEY CANARY', { code: 'PROFILE_INCOMPATIBLE' })
        return applicationEffective
    })
    choose('My storyteller')
    await screen.findByRole('alert')
    expect(screen.getByText('Uses platform credits')).toBeInTheDocument()
    expect((await prepareLlmDispatch('novel'))().selection).toEqual({ mode: 'profile', profile_id: applicationProfile.profile_id })
    expect(document.body.textContent).not.toContain('PRIVATE KEY CANARY')
})
it('shows system-only writers without a personal selector or profile enumeration', async () => {
    mount('image_prompt'); await within(await openChip()).findByText('Fixture writer')
    expect(screen.queryByRole('button', { name: 'Change profile' })).not.toBeInTheDocument()
    expect(screen.getByText(/Their media charges are separate/)).toBeInTheDocument()
    expect(mocks.profiles).not.toHaveBeenCalled()
})
it('discards a pending preview after an account change', async () => {
    let complete!: (value: typeof personalEffective) => void
    mocks.resolve.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const view = mount()
    act(() => { authSession.authenticate('bob', token); grantFixtureFeatures(true); view.rerender(<LlmSessionProvider><LlmFeatureControl feature="novel" /></LlmSessionProvider>) })
    await openChip(); await screen.findByText('Uses platform credits')
    await act(async () => complete(personalEffective))
    expect(screen.queryByText('A provider key will be requested before running.')).not.toBeInTheDocument()
})
it('reports the previewed resolution to a host that fits its budget, and clears it when resolution fails', async () => {
    const effective = vi.fn()
    const { unmount } = render(<LlmSessionProvider><LlmFeatureControl feature="novel" onEffectiveChange={effective} /></LlmSessionProvider>)
    await waitFor(() => expect(effective).toHaveBeenLastCalledWith(applicationEffective))
    unmount()
    effective.mockClear(); mocks.resolve.mockRejectedValue(new ApiError(503, 'unavailable', { code: 'LLM_EXECUTION_CATALOG_UNAVAILABLE' }))
    render(<LlmSessionProvider><LlmFeatureControl feature="novel" onEffectiveChange={effective} /></LlmSessionProvider>)
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument()
    expect(effective).toHaveBeenCalled()
    expect(effective).not.toHaveBeenCalledWith(applicationEffective)
})
