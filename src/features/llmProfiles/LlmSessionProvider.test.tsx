import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import '@/app/i18n'
import { authSession } from '@/infrastructure/api/authSession'
import { prepareLlmDispatch } from '@/infrastructure/api/llmPreparation'
import { LlmSessionProvider } from './LlmSessionProvider'
import { credentialSession } from './credentialSession'

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), retry: vi.fn(), recovery: vi.fn(), baseUrl: 'https://api.test.invalid' }))
vi.mock('@/infrastructure/api/baseUrl', () => ({ get API_BASE_URL() { return mocks.baseUrl } }))
vi.mock('@/infrastructure', () => ({ apiService: { resolveLlmProfile: mocks.resolve, getLlmRetryProfile: mocks.retry, getLlmRecoveryProfile: mocks.recovery } }))
vi.mock('@/app/hooks', () => ({ useAuth: () => authSession.getSnapshot() }))
const profile = { project_hash: 'project-one', profile_id: '11111111-1111-4111-8111-111111111111', revision_id: '22222222-2222-4222-8222-222222222222',
    profile_scope: 'user', credential_mode: 'user_byok', provider_target_key: 'approved-target', platform_connection_key: null,
    resolution_source: 'user_default', catalog_revision: 'catalog-one', policy_revision: 'policy-one', roles: { primary: {} } }
const KEY = 'FAKE_DIALOG_CANARY'
const token = `header.${btoa(JSON.stringify({ project_hash: 'project-one' }))}.signature`
beforeEach(() => { mocks.baseUrl = 'https://api.test.invalid'; vi.stubEnv('DEV', true); credentialSession.clear(); authSession.continueSignedOut(); authSession.authenticate('alice', token); grantFixtureFeatures(true); credentialSession.setProject('project-one', authSession.getSnapshot().accountKey); mocks.resolve.mockResolvedValue(profile) })
afterEach(() => { credentialSession.clear(); authSession.continueSignedOut(); vi.clearAllMocks(); vi.unstubAllEnvs() })

it.each(['https://api.test.invalid', 'http://localhost:8010'])('confirms a key once and materializes it only at dispatch over %s', async baseUrl => {
    mocks.baseUrl = baseUrl
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    let prepared!: Promise<() => ReturnType<typeof credentialSession.materialize>>
    act(() => { prepared = prepareLlmDispatch('novel') })
    const field = await screen.findByLabelText('Provider API key')
    fireEvent.change(field, { target: { value: KEY } })
    fireEvent.click(screen.getByRole('button', { name: 'Use for this session' }))
    const materialize = await prepared
    expect(field).toHaveValue('')
    expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
    expect(materialize().credentials?.api_key).toBe(KEY)
    expect(JSON.stringify(localStorage)).not.toContain(KEY); expect(JSON.stringify(sessionStorage)).not.toContain(KEY)
    credentialSession.clear()
    expect(materialize).toThrow('BYOK_CREDENTIAL_REQUIRED')
})
it('refuses production loopback HTTP before opening the key dialog', async () => {
    mocks.baseUrl = 'http://localhost:8010'
    vi.stubEnv('DEV', false)
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    await act(async () => {
        await expect(prepareLlmDispatch('chat_character')).rejects.toMatchObject({ code: 'LLM_CREDENTIAL_HTTPS_REQUIRED' })
    })
    expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument()
})
it('cancels credential entry without creating a request or retaining the input', async () => {
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    let prepared!: Promise<unknown>
    act(() => { prepared = prepareLlmDispatch('novel') })
    const rejected = expect(prepared).rejects.toMatchObject({ name: 'AbortError' })
    const field = await screen.findByLabelText('Provider API key'); fireEvent.change(field, { target: { value: KEY } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); await rejected
    expect(field).toHaveValue(''); expect(credentialSession.has(profile as never)).toBe(false)
})
it('rejects a prepared factory after account ownership changes', async () => {
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    act(() => { credentialSession.remember(profile as never, KEY, credentialSession.ownerScope()) })
    const materialize = await prepareLlmDispatch('novel')
    authSession.authenticate('bob', token)
    expect(materialize).toThrow('LLM_SESSION_CHANGED')
})
it('cleans the dialog and rejects its pending request on terminal authentication expiry', async () => {
    const view = render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    let prepared!: Promise<unknown>
    act(() => { prepared = prepareLlmDispatch('novel') })
    const rejected = expect(prepared).rejects.toMatchObject({ name: 'AbortError' })
    const field = await screen.findByLabelText('Provider API key'); fireEvent.change(field, { target: { value: KEY } })
    act(() => { authSession.expire(); view.rerender(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>) })
    await rejected; await waitFor(() => expect(screen.queryByLabelText('Provider API key')).not.toBeInTheDocument())
    expect(field).toHaveValue('')
})

it('uses the retained revision and demands a fresh key for each new terminal attempt', async () => {
    mocks.retry.mockResolvedValue(profile)
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    act(() => { credentialSession.remember(profile as never, KEY, credentialSession.ownerScope()) })
    let prepared!: Promise<() => ReturnType<typeof credentialSession.materialize>>
    act(() => { prepared = prepareLlmDispatch('novel', undefined, { mode: 'profile', profile_id: profile.profile_id }, 'parent-execution') })
    const field = await screen.findByLabelText('Provider API key')
    expect(credentialSession.has(profile as never)).toBe(false)
    fireEvent.change(field, { target: { value: 'FRESH_RETRY_CANARY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use for this session' }))
    const request = (await prepared)()
    expect(mocks.retry).toHaveBeenCalledWith('novel', 'parent-execution')
    expect(mocks.resolve).not.toHaveBeenCalled()
    expect(request.expected_revision_id).toBe(profile.revision_id)
    expect(request.credentials?.api_key).toBe('FRESH_RETRY_CANARY')
    expect(field).toHaveValue('')
})

it('prepares a pending request from its owned frozen plan after another revision was published', async () => {
    mocks.recovery.mockResolvedValue(profile)
    mocks.resolve.mockResolvedValue({ ...profile, revision_id: '33333333-3333-4333-8333-333333333333' })
    render(<LlmSessionProvider><span>Fixture</span></LlmSessionProvider>)
    let prepared!: Promise<() => ReturnType<typeof credentialSession.materialize>>
    act(() => { prepared = prepareLlmDispatch('novel', undefined, { mode: 'profile', profile_id: profile.profile_id }, undefined, 'original-request') })
    const field = await screen.findByLabelText('Provider API key')
    fireEvent.change(field, { target: { value: 'FAKE_RESUME_CANARY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use for this session' }))
    const request = (await prepared)()
    expect(mocks.recovery).toHaveBeenCalledWith('novel', 'original-request', undefined)
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.retry).not.toHaveBeenCalled()
    expect(request.expected_revision_id).toBe(profile.revision_id)
    expect(request.credentials?.api_key).toBe('FAKE_RESUME_CANARY')
    expect(field).toHaveValue('')
})
