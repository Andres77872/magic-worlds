import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { apiService } from '@/infrastructure/api'
import type { AgentDetail, AgentModelOption, AgentSummary } from '@/shared'
import { AdminAgentsPage } from './AdminAgentsPage'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

const sourceAgent: AgentSummary = {
    workflow_key: 'card_world',
    kind: 'card',
    storage: 'file',
    display_name: 'World generator',
    output_mode: 'strict_card_schema',
    schema_model: 'WorldCardBody',
    is_system: true,
    has_published: true,
    has_unpublished_draft: false,
    published_version_number: 1,
    latest_version_number: 1,
    updated_at: null,
}

const sourceDetail: AgentDetail = {
    ...sourceAgent,
    graph_version_prefix: 'world-generator',
    draft: {
        system_message: 'Create vivid world cards while preserving the requested setting and tone.',
        prompt_template: '{{input}}',
        model: '{{env.CARD_LLM_MODEL}}',
        temperature: 0.7,
        max_tokens: 4096,
        top_p: null,
        max_messages: 12,
        max_input_tokens: 12000,
        truncation_strategy: 'tail',
        timeout: 120,
        json_output: true,
    },
    published: {
        system_message: 'Create vivid world cards while preserving the requested setting and tone.',
        prompt_template: '{{input}}',
        model: '{{env.CARD_LLM_MODEL}}',
        temperature: 0.7,
        max_tokens: 4096,
        top_p: null,
        max_messages: 12,
        max_input_tokens: 12000,
        truncation_strategy: 'tail',
        timeout: 120,
        json_output: true,
        version_number: 1,
        graph_version: 'world-generator-v1',
    },
}

const models: AgentModelOption[] = [{
    id: 'openai/gpt-5-mini',
    label: 'GPT-5 mini',
    owned_by: 'OpenAI',
    context_length: 400_000,
    status: 'available',
}]

const rootAuth: AuthValue = {
    isAuthenticated: true,
    user: {
        user_hash: 'root-story',
        username: 'root',
        user_type: 'root',
        created_at: null,
        updated_at: null,
    },
    token: 'storybook-token',
    projects: [],
    isLoading: false,
    error: null,
    sessionPhase: 'authenticated',
    authEpoch: 1,
    accountKey: 'root-story',
    userHash: null,
    isLoginModalOpen: false,
    login: async () => false,
    register: async () => false,
    loginWithGoogle: async () => {},
    completeGoogleLogin: async () => false,
    logout: async () => {},
    continueSignedOut: () => {},
    updateUser: () => {},
    clearError: () => {},
    openLoginModal: () => {},
    closeLoginModal: () => {},
}

const withAgentApi: Decorator = (Story) => {
    apiService.listAgents = async () => [sourceAgent]
    apiService.listAgentModels = async () => ({ models })
    apiService.getAgent = async () => sourceDetail
    return (
        <AuthContext.Provider value={rootAuth}>
            <Story />
        </AuthContext.Provider>
    )
}

const meta = {
    title: 'Features/Admin/AgentStudio',
    component: AdminAgentsPage,
    tags: ['autodocs'],
    decorators: [withAgentApi],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Root-only Agent Studio. File-backed agents are immutable; this story opens the custom-copy flow with the source, editable name, and slug prefilled.',
            },
        },
    },
} satisfies Meta<typeof AdminAgentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const CreateCustomCopy: Story = {
    play: async ({ canvasElement }) => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            if (canvasElement.textContent?.includes(sourceAgent.display_name)) {
                const button = Array.from(canvasElement.querySelectorAll('button')).find(
                    (candidate) => candidate.textContent?.trim() === 'Create custom copy',
                )
                if (button) {
                    button.click()
                    break
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 25))
        }
    },
}
