import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LlmProfilesPage } from './LlmProfilesPage'
import { ApiError } from '@/infrastructure/api'
import { personalCapacityUsage } from './llmCapacityFixtures'

const mocks = vi.hoisted(() => ({
    root: false, authenticated: true,
    profiles: vi.fn(), models: vi.fn(), features: vi.fn(), preferences: vi.fn(), connections: vi.fn(), audit: vi.fn(),
    detail: vi.fn(), save: vi.fn(), savePreferences: vi.fn(), publish: vi.fn(), test: vi.fn(), login: vi.fn(),
    capacity: vi.fn(), compatibility: vi.fn(), setPage: vi.fn(),
}))
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: mocks.authenticated, accountKey: 'owner-one', user: { user_type: mocks.root ? 'root' : 'consumer' }, openLoginModal: mocks.login }),
    useNavigation: () => ({ setPage: mocks.setPage }),
}))
vi.mock('@/infrastructure', () => ({ apiService: {
    getLlmProfiles: mocks.profiles, getLlmModels: mocks.models, getLlmFeatures: mocks.features,
    getLlmPreferences: mocks.preferences, getLlmConnections: mocks.connections, getLlmAudit: mocks.audit,
    getLlmProfile: mocks.detail, saveLlmProfile: mocks.save, saveLlmPreferences: mocks.savePreferences,
    publishLlmProfile: mocks.publish, testLlmProfile: mocks.test,
    getLlmCapacityUsage: mocks.capacity, checkLlmProfileCompatibility: mocks.compatibility,
} }))

const ID = '11111111-1111-4111-8111-111111111111'
const config = { provider_target_key: 'approved-target', catalog_revision: 'catalog-one', platform_connection_key: 'platform-connection',
    roles: { primary: { catalog_model_key: 'writer', endpoint: 'chat_completions', settings: { max_input_tokens: 1000, max_output_tokens: 200, max_messages: 10, timeout_seconds: 30, truncation_strategy: 'token_budget' } } } }
const summary = { profile_id: ID, scope: 'system', name: 'Application writer', description: 'Safe fixture', status: 'active', row_version: 4 }
const detail = { ...summary, current: { revision_id: '22222222-2222-4222-8222-222222222222', revision_number: 1, config }, revisions: [], draft_config: config,
    impact: { system_defaults: 1, system_features: 1, user_defaults: 0, user_features: 0, affected_features: ['novel'] } }
const writer = { catalog_model_key: 'writer', provider_target_key: 'approved-target', catalog_revision: 'catalog-one', display_name: 'Writer', status: 'active',
    context_window: 4096, max_output_tokens: 1024, supported_parameters: [], compatible_endpoints: ['chat_completions'], capabilities: ['chat', 'json'] }

beforeEach(() => {
    vi.clearAllMocks(); mocks.root = false; mocks.authenticated = true
    mocks.profiles.mockResolvedValue({ items: [summary], total: 1, limit: 25, offset: 0 })
    mocks.models.mockResolvedValue({ items: [writer], total: 1 })
    mocks.features.mockResolvedValue({ features: [
        { feature_key: 'novel', user_selection_enabled: true, byok_enabled: true, roles: ['primary'], requirements: { primary: { capabilities: ['chat', 'streaming'] } } },
        { feature_key: 'chat_adventure', user_selection_enabled: true, byok_enabled: true, roles: ['primary', 'metadata', 'preflight'],
            requirements: { primary: { capabilities: ['chat', 'streaming'] }, metadata: { capabilities: ['chat', 'tools'] }, preflight: { capabilities: ['chat', 'tools'] } } },
        { feature_key: 'image_prompt', user_selection_enabled: false, byok_enabled: false, roles: ['primary'], requirements: { primary: { capabilities: ['chat', 'json'] } } },
    ] })
    mocks.preferences.mockResolvedValue({ default_profile_id: ID, feature_profiles: { novel: ID, card_assistant: ID }, row_version: 7, generation: 3 })
    mocks.connections.mockResolvedValue({ connections: [{ connection_key: 'platform-connection', provider_target_key: 'approved-target', available: true }] })
    mocks.audit.mockResolvedValue({ items: [] }); mocks.detail.mockResolvedValue(detail)
    mocks.capacity.mockResolvedValue(personalCapacityUsage)
    mocks.compatibility.mockResolvedValue({ configuration_issue: null, features: [
        { feature: 'novel', roles: ['primary'], compatible: false, issue: { code: 'MODEL_CONTEXT_INSUFFICIENT', role: 'primary' } },
        { feature: 'chat_adventure', roles: ['primary', 'metadata', 'preflight'], compatible: true, issue: null }] })
    mocks.save.mockResolvedValue({ ...detail, scope: 'user', current: { ...detail.current, config: { ...config, platform_connection_key: null } } })
    mocks.savePreferences.mockResolvedValue({ default_profile_id: ID, feature_profiles: { novel: ID, card_assistant: ID }, row_version: 8, generation: 4 })
})

async function openRootEditor() {
    mocks.root = true
    render(<LlmProfilesPage systemAdmin />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }))
    return screen.findByLabelText('Name')
}

it('requires root before fetching any system configuration', () => {
    render(<LlmProfilesPage systemAdmin />)
    expect(screen.getByText('This console requires root access.')).toBeInTheDocument()
    expect(mocks.profiles).not.toHaveBeenCalled(); expect(mocks.connections).not.toHaveBeenCalled()
    expect(mocks.capacity).not.toHaveBeenCalled()
})

it('shows personal request counts by payer without presenting BYOK as app-credit consumption', async () => {
    render(<LlmProfilesPage />)
    expect(await screen.findByRole('table', { name: 'Requests today / this month (UTC)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Your key · no app credits' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '2 / 9' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Earlier · payer unknown' })).toBeInTheDocument()
    expect(screen.queryByText('9 credits')).not.toBeInTheDocument()
})

it('keeps profile settings usable when personal usage is unavailable and hides provider errors', async () => {
    mocks.capacity.mockRejectedValue(new Error('PRIVATE PROVIDER CANARY'))
    render(<LlmProfilesPage />)
    expect(await screen.findByText('Request usage could not be loaded. Refresh to try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save assignments' })).toBeEnabled()
    expect(screen.queryByText(/PRIVATE PROVIDER CANARY/)).not.toBeInTheDocument()
})
it('keeps system configuration read-only for a user and strips its connection when copying', async () => {
    render(<LlmProfilesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View profile' }))
    const copy = await screen.findByRole('button', { name: 'Copy as personal profile' })
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
    fireEvent.click(copy)
    expect(await screen.findByLabelText('Name')).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const [body, admin, existing] = mocks.save.mock.calls[0]
    expect(body.config.platform_connection_key).toBeNull(); expect(admin).toBe(false); expect(existing).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('credentials')
})
it('saves the complete preference map with the observed version', async () => {
    render(<LlmProfilesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save assignments' }))
    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledWith({ default_profile_id: ID, feature_profiles: { novel: ID, card_assistant: ID } }, 7, false))
    expect(mocks.test).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled()
})
it('limits personal assignments to selectable features and marks those that use the separate models', async () => {
    render(<LlmProfilesPage />)
    const table = await screen.findByRole('table', { name: 'Which profile each feature uses' })
    expect(within(table).getByRole('combobox', { name: 'Novel writing' })).toBeInTheDocument()
    expect(within(table).queryByRole('combobox', { name: 'Image prompt writing' })).not.toBeInTheDocument()
    const adventure = within(table).getByRole('row', { name: /Adventure chat/ })
    expect(within(adventure).getByText('Also uses preflight model, metadata model')).toBeInTheDocument()
})
it('shows why the server refused an assignment on the row it concerns', async () => {
    mocks.root = true
    mocks.savePreferences.mockRejectedValueOnce(new ApiError(422, 'PROFILE_INCOMPATIBLE', { code: 'PROFILE_INCOMPATIBLE',
        details: { code: 'PROFILE_INCOMPATIBLE', issues: [{ code: 'PROFILE_INCOMPATIBLE', feature: 'novel', role: 'primary' }] } }))
        .mockRejectedValueOnce(new ApiError(422, 'SYSTEM_DEFAULT_REQUIRED', { code: 'SYSTEM_DEFAULT_REQUIRED', details: { code: 'SYSTEM_DEFAULT_REQUIRED' } }))
    render(<LlmProfilesPage systemAdmin />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save assignments' }))
    const table = screen.getByRole('table', { name: 'Which profile each feature uses' })
    const row = await within(table).findByRole('row', { name: /Novel writing/ })
    expect(within(row).getByText('This profile’s response model lacks Streaming needed by Novel writing, or is not verified for it.')).toBeInTheDocument()
    expect(screen.getByText('Some assignments could not be saved. Check the highlighted rows.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save assignments' }))
    expect(await within(table).findByText('Set a default first. Features without their own profile use it.')).toBeInTheDocument()
})
it('warns, without blocking the save, when the default cannot serve a feature left on it', async () => {
    mocks.root = true
    mocks.compatibility.mockResolvedValue({ configuration_issue: null, features: [
        { feature: 'novel', roles: ['primary'], compatible: true, issue: null },
        { feature: 'image_prompt', roles: ['primary'], compatible: false, issue: { code: 'PROFILE_INCOMPATIBLE', role: 'primary' } }] })
    render(<LlmProfilesPage systemAdmin />)
    const table = await screen.findByRole('table', { name: 'Which profile each feature uses' })
    const row = await within(table).findByRole('row', { name: /Image prompt writing/ })
    expect(await within(row).findByText('Default can’t serve this feature: assign one.')).toBeInTheDocument()
    expect(within(table).queryAllByText('Default can’t serve this feature: assign one.')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Save assignments' }))
    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledOnce())
})
it('lets root set a published profile as the default for everyone', async () => {
    mocks.root = true
    mocks.preferences.mockResolvedValue({ default_profile_id: null, feature_profiles: { novel: ID }, row_version: 7, generation: 3 })
    mocks.savePreferences.mockResolvedValue({ default_profile_id: ID, feature_profiles: { novel: ID }, row_version: 8, generation: 4 })
    render(<LlmProfilesPage systemAdmin />)
    expect(await screen.findByRole('heading', { name: 'No default profile' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Set as default for everyone' }))
    await waitFor(() => expect(mocks.savePreferences).toHaveBeenCalledWith({ default_profile_id: ID, feature_profiles: { novel: ID } }, 7, true))
    expect(mocks.preferences).toHaveBeenLastCalledWith(true)
    expect(await screen.findByText('Default for everyone')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No default profile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set as default for everyone' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Which profile each feature uses' })).getAllByRole('combobox')[0]).toHaveTextContent('Application writer')
})
it('links a root user from the personal page to the app-profile console', async () => {
    mocks.root = true
    render(<LlmProfilesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manage app profiles' }))
    expect(mocks.setPage).toHaveBeenCalledWith('admin-llm-profiles')
})
it('explains an empty personal catalog and disables creating instead of failing after the click', async () => {
    mocks.models.mockResolvedValue({ items: [], total: 0 })
    render(<LlmProfilesPage />)
    expect(await screen.findByText('Your account has no models available yet. An administrator must add models to a group your account belongs to.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View profile' })).toBeEnabled()
})
it('keeps a failed draft edit available without publishing or testing it', async () => {
    mocks.save.mockRejectedValue(new Error('PRIVATE PROVIDER CANARY'))
    const input = await openRootEditor()
    fireEvent.change(input, { target: { value: 'My preserved draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findAllByRole('alert')
    expect(input).toHaveValue('My preserved draft'); expect(mocks.save.mock.calls[0][2]).toEqual({ id: ID, version: 4 })
    expect(screen.queryByText(/PRIVATE PROVIDER CANARY/)).not.toBeInTheDocument()
    expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.test).not.toHaveBeenCalled()
})
it('saves custom provider props only while they form a valid object without reserved fields', async () => {
    const input = await openRootEditor()
    expect(input).toHaveValue('Application writer')
    fireEvent.click(screen.getByRole('button', { name: /Custom provider props/ }))
    const props = screen.getByRole('textbox', { name: 'Props as a JSON object' })
    fireEvent.change(props, { target: { value: '{"api_key": "nope"}' } })
    expect(screen.getByText('“api_key” is reserved and cannot be set here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    fireEvent.change(props, { target: { value: '{"Bad-Key": 1}' } })
    expect(screen.getByText(/is not a valid field name/)).toBeInTheDocument()
    fireEvent.change(props, { target: { value: '{"provider_flag": {"mode": "fast"}}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.save.mock.calls[0][0].config.provider_options).toEqual({ provider_flag: { mode: 'fast' } })
})

it('tests the saved system draft against the chosen contract and reports every role', async () => {
    mocks.test.mockResolvedValue({ execution_id: 'execution-one', profile_id: ID, revision_id: 'draft-revision', payer_mode: 'platform',
        feature: 'chat_adventure', roles: ['primary', 'metadata', 'preflight'], target: 'draft', replayed: false, output: 'OK' })
    await openRootEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Feature to test' }))
    fireEvent.click(screen.getByRole('option', { name: /^Adventure chat/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Test saved draft' }))
    await waitFor(() => expect(mocks.test).toHaveBeenCalledWith(ID, { kind: 'draft', draftVersion: 4 }, 'chat_adventure', expect.any(String), true, undefined, undefined))
    expect(await screen.findByText('Saved draft · Adventure chat · Response model, Metadata model, Preflight model answered. Reply: OK')).toBeInTheDocument()
    expect(mocks.publish).not.toHaveBeenCalled()
})
it('requires saving local edits before testing a draft', async () => {
    fireEvent.change(await openRootEditor(), { target: { value: 'Unsaved rename' } })
    expect(screen.getByText('Draft — unsaved changes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(screen.getByRole('button', { name: 'Test saved draft' })).toBeDisabled()
    expect(screen.getByText('Save your changes to test this draft.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test published profile' })).toBeEnabled()
})
it('offers personal tests only for contracts that accept the user key and never a draft', async () => {
    mocks.profiles.mockResolvedValue({ items: [{ ...summary, scope: 'user' }], total: 1, limit: 25, offset: 0 })
    mocks.detail.mockResolvedValue({ ...detail, scope: 'user', current: { ...detail.current, config: { ...config, platform_connection_key: null } } })
    render(<LlmProfilesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Test' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Feature to test' }))
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([expect.stringMatching(/^Novel writing/), expect.stringMatching(/^Adventure chat/)])
    expect(screen.queryByRole('button', { name: 'Test saved draft' })).not.toBeInTheDocument()
})

it('checks the edited configuration on the server and blocks publishing an assigned incompatible feature', async () => {
    await openRootEditor()
    const panel = await screen.findByRole('group', { name: 'Compatibility by feature' })
    expect(await within(panel).findByText('Response model has too little context for this feature’s output budget.')).toBeInTheDocument()
    expect(mocks.compatibility).toHaveBeenCalledWith(config, true)
    fireEvent.click(screen.getByRole('button', { name: 'Publish saved draft' }))
    expect(await screen.findByText(/Publishing is blocked until these assigned features are compatible: Novel writing\./)).toBeInTheDocument()
})
it('keeps validation and publication on the saved draft while local edits are unsaved', async () => {
    fireEvent.change(await openRootEditor(), { target: { value: 'Unsaved rename' } })
    expect(screen.getByRole('button', { name: 'Publish saved draft' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(screen.getByRole('button', { name: 'Validate saved draft' })).toBeDisabled()
})


it.each([true, false])('retains an uncertain profile test and links only a confirmed failure (%s)', async confirmed => {
    const failure = new ApiError(409, 'Test failed.', { code: 'LLM_EXECUTION_FINISHED' })
    const parent = '44444444-4444-4444-8444-444444444444'
    if (confirmed) failure.llmRetry = { retry_of_execution_id: parent, selection: { mode: 'profile', profile_id: ID } }
    mocks.test.mockRejectedValueOnce(failure).mockResolvedValueOnce({ execution_id: 'execution-child', profile_id: ID,
        revision_id: 'draft-revision', payer_mode: 'platform', feature: 'novel', roles: ['primary'], target: 'draft', replayed: false, output: 'OK' })
    await openRootEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Test saved draft' }))
    await waitFor(() => expect(mocks.test).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test saved draft' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Test saved draft' }))
    await waitFor(() => expect(mocks.test).toHaveBeenCalledTimes(2))
    expect(mocks.test.mock.calls[1][3] === mocks.test.mock.calls[0][3]).toBe(!confirmed)
    expect(mocks.test.mock.calls[1].slice(0, 3)).toEqual(mocks.test.mock.calls[0].slice(0, 3))
    expect(mocks.test.mock.calls[1][6]).toBe(confirmed ? parent : undefined)
    expect(mocks.publish).not.toHaveBeenCalled()
})
