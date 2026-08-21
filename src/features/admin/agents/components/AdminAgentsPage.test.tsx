import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAgentsPage } from './AdminAgentsPage'

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
const listAgentModels = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('@/infrastructure/api', () => ({
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
        listAgentModels: (...a: unknown[]) => listAgentModels(...a),
    },
}))

const rootUser = { user_hash: 'usr-root', username: 'root', user_type: 'root' }
const consumerUser = { ...rootUser, user_type: 'consumer' }

const summary = {
    workflow_key: 'character_generation',
    kind: 'builtin_card',
    storage: 'file',
    display_name: 'Character generator',
    output_mode: 'strict_card_schema',
    schema_model: 'Character',
    is_system: true,
    has_published: true,
    has_unpublished_draft: false,
    published_version_number: 1,
    latest_version_number: 1,
    updated_at: null,
}

const detail = {
    ...summary,
    graph_version_prefix: 'mw-content-character',
    draft: {
        system_message: 'You generate character cards.',
        prompt_template: 'Create one character from:\n{{handle_parser_input_0}}',
        model: '{{env.CARD_LLM_MODEL}}',
        temperature: 0.7,
        max_tokens: 4096,
        top_p: null,
        json_output: true,
        max_messages: 4,
        max_input_tokens: 8000,
        truncation_strategy: 'tail',
        timeout: 120,
    },
    published: null,
}

describe('AdminAgentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, openLoginModal: vi.fn() })
        listAgents.mockResolvedValue([summary])
        getAgent.mockResolvedValue(detail)
        updateAgentDraft.mockResolvedValue(detail)
        publishAgent.mockResolvedValue({ ...detail, published_version_number: 2 })
        testAgent.mockResolvedValue({ output_mode: 'strict_card_schema', graph_version: 'mw-content-character-v1', json_output: { name: 'Nyra' } })
        listAgentModels.mockResolvedValue({ models: [{ id: 'gpt-4o', label: 'gpt-4o', owned_by: 'openai', context_length: 128000, status: 'active' }] })
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
        expect(listAgentModels).toHaveBeenCalled()

        // Select the agent from the list (the list button shows its name).
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))

        expect(await screen.findByLabelText('System message')).toBeDisabled()
        expect(screen.getAllByRole('button', { name: 'Create custom copy' }).length).toBeGreaterThan(0)
        expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Publish/ })).not.toBeInTheDocument()
    })

    it('publishes and runs a non-persisting test', async () => {
        render(<AdminAgentsPage />)
        await waitFor(() => expect(listAgents).toHaveBeenCalled())
        fireEvent.click(await screen.findByRole('button', { name: /Character generator/ }))

        await screen.findByLabelText('System message')
        fireEvent.change(screen.getByLabelText('Sample input'), { target: { value: 'A moonlit scout' } })
        fireEvent.click(screen.getByRole('button', { name: 'Run test' }))
        await waitFor(() => {
            expect(testAgent).toHaveBeenCalledWith(
                'character_generation',
                expect.objectContaining({ input_text: 'A moonlit scout', source: 'draft' }),
            )
        })
        expect(await screen.findByText(/"name": "Nyra"/)).toBeInTheDocument()
    })

    it('creates an exact custom copy request from the selected file agent', async () => {
        createAgent.mockResolvedValue({ ...detail, storage: 'database', workflow_key: 'custom_character_generator_copy', is_system: false })
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
