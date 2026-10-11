import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAgentsPage } from './AdminAgentsPage'
import { ApiError } from '@/infrastructure/api'

const mockUseAuth = vi.fn()
const listAgents = vi.fn()
const getAgent = vi.fn()
const createAgent = vi.fn()
const updateAgentDraft = vi.fn()
const publishAgent = vi.fn()
const listAgentVersions = vi.fn()
const rollbackAgentVersion = vi.fn()
const deleteAgent = vi.fn()
const testAgent = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('@/infrastructure/api', async importOriginal => ({
    ApiError: (await importOriginal<typeof import('@/infrastructure/api')>()).ApiError,
    apiService: {
        listAgents: (...a: unknown[]) => listAgents(...a),
        getAgent: (...a: unknown[]) => getAgent(...a),
        createAgent: (...a: unknown[]) => createAgent(...a),
        updateAgentDraft: (...a: unknown[]) => updateAgentDraft(...a),
        publishAgent: (...a: unknown[]) => publishAgent(...a),
        listAgentVersions: (...a: unknown[]) => listAgentVersions(...a),
        rollbackAgentVersion: (...a: unknown[]) => rollbackAgentVersion(...a),
        deleteAgent: (...a: unknown[]) => deleteAgent(...a),
        testAgent: (...a: unknown[]) => testAgent(...a),
    },
}))

const rootUser = { user_hash: 'usr-root', username: 'root', user_type: 'root' }
const consumerUser = { ...rootUser, user_type: 'consumer' }

const summary = {
    workflow_key: 'character_generation', kind: 'builtin_card', display_name: 'Character generator',
    output_mode: 'strict_card_schema', schema_model: 'Character', builtin_version: 2,
    graph_version: 'mw-content-character-v2',
}
const detail = {
    ...summary, graph_version_prefix: 'mw-content-character',
    editable: { system_message: 'You generate character cards.',
        prompt_template: 'Create one character from:\n{{handle_parser_input_0}}', json_output: true },
}
const custom = {
    workflow_key: 'custom_character_generator_copy', kind: 'custom', display_name: 'Character generator copy',
    output_mode: 'strict_card_schema', schema_model: 'Character', graph_version_prefix: 'mw-custom-character_generator_copy',
    row_version: 1, has_draft_changes: false, current_version_number: 1, latest_version_number: 1,
    updated_at: null, draft: detail.editable,
    current: {...detail.editable, version_number: 1, graph_version: 'mw-custom-character_generator_copy-v1',
        output_mode: 'strict_card_schema', schema_model: 'Character'},
}
const provenance={execution_id:'11111111-1111-4111-8111-111111111111',profile_id:'22222222-2222-4222-8222-222222222222',
    revision_id:'33333333-3333-4333-8333-333333333333',resolution_source:'system_default',credential_mode:'platform',replayed:false}

describe('AdminAgentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, openLoginModal: vi.fn() })
        listAgents.mockResolvedValue([summary])
        getAgent.mockResolvedValue(detail)
        updateAgentDraft.mockResolvedValue(custom)
        publishAgent.mockResolvedValue({ ...custom, current_version_number: 2 })
        testAgent.mockResolvedValue({ output_mode: 'strict_card_schema', graph_version: 'mw-content-character-v2', llm_execution: provenance, json_output: { name: 'Nyra' } })
    })

    it('asks signed-out users to log in', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, openLoginModal })
        render(<AdminAgentsPage />)
        expect(screen.getByText('Root access required')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(listAgents).not.toHaveBeenCalled()
    })

    it('denies authenticated non-root users', () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: consumerUser, openLoginModal: vi.fn() })
        render(<AdminAgentsPage />)
        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText(/limited to root users/i)).toBeInTheDocument()
        expect(listAgents).not.toHaveBeenCalled()
    })

    it('renders built-in file agents read-only with test and copy actions only', async () => {
        render(<AdminAgentsPage />)

        await waitFor(() => expect(listAgents).toHaveBeenCalled())

        // Select the agent from the list (the list button shows its name).
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))

        expect(await screen.findByLabelText('System message')).toBeDisabled()
        expect(screen.queryByLabelText('Model')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Temperature')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Create custom copy' }).length).toBeGreaterThan(0)
        expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument()
    })

    it('tests the immutable current workflow using inherited profile selection', async () => {
        render(<AdminAgentsPage />)
        await waitFor(() => expect(listAgents).toHaveBeenCalled())
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))

        await screen.findByLabelText('System message')
        fireEvent.change(screen.getByLabelText('Sample input'), { target: { value: 'A moonlit scout' } })
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => {
            expect(testAgent).toHaveBeenCalledWith(
                'character_generation',
                { input_text: 'A moonlit scout', source: 'current' },
                expect.stringMatching(/^mw-agent-test-/),
                'card_generation',
            )
        })
        expect(await screen.findByText(/"name": "Nyra"/)).toBeInTheDocument()
    })

    it.each([
        ['an interrupted run resumes its request ID', { code: 'LLM_EXECUTION_RECOVERY_REQUIRED' }, true],
        ['an unconfirmed spent run keeps the original request', { code: 'LLM_EXECUTION_FINISHED' }, true],
    ])('%s when the same test is tried again', async (_case, failure, same) => {
        testAgent.mockRejectedValueOnce(Object.assign(new Error('Test failed.'), failure))
        render(<AdminAgentsPage />)
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))
        await screen.findByLabelText('System message')
        fireEvent.change(screen.getByLabelText('Sample input'), { target: { value: 'A moonlit scout' } })
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => expect(testAgent).toHaveBeenCalledOnce())
        await waitFor(() => expect(screen.getByRole('button', { name: 'Run test' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => expect(testAgent).toHaveBeenCalledTimes(2))
        const [first, second] = testAgent.mock.calls.map((call) => call[2])
        expect(first === second).toBe(same)
    })

    it('starts a new linked attempt only after the API confirms a terminal parent', async () => {
        const failure = new ApiError(502, 'Test failed.', { code: 'LLM_EXECUTION_UPSTREAM_FAILED' })
        failure.llmRetry = { retry_of_execution_id: '44444444-4444-4444-8444-444444444444',
            selection: { mode: 'profile', profile_id: '11111111-1111-4111-8111-111111111111' },
            expected_revision_id: '22222222-2222-4222-8222-222222222222' }
        testAgent.mockRejectedValueOnce(failure)
        render(<AdminAgentsPage />)
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))
        await screen.findByLabelText('System message')
        fireEvent.change(screen.getByLabelText('Sample input'), { target: { value: 'A moonlit scout' } })
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Run test' })).toBeEnabled())
        expect(testAgent).toHaveBeenCalledOnce()
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => expect(testAgent).toHaveBeenCalledTimes(2))
        expect(testAgent.mock.calls[1][2]).not.toBe(testAgent.mock.calls[0][2])
        expect(testAgent.mock.calls[1][1]).toEqual({ input_text: 'A moonlit scout', source: 'current', llm: failure.llmRetry })
    })

    it('creates an exact custom copy request from the selected file agent', async () => {
        createAgent.mockResolvedValue(custom)
        render(<AdminAgentsPage />)
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))
        await screen.findByLabelText('System message')
        const copyButtons = await screen.findAllByRole('button', { name: 'Create custom copy' })
        fireEvent.click(copyButtons[copyButtons.length - 1])

        expect(await screen.findByLabelText('Copy from')).toHaveTextContent('Character generator')
        fireEvent.click(screen.getByRole('button', { name: 'Create copy' }))

        await waitFor(() =>
            expect(createAgent).toHaveBeenCalledWith({
                display_name: 'Character generator copy',
                slug: 'character_generator_copy',
                source_workflow_key: 'character_generation',
            }),
        )
    })
})
