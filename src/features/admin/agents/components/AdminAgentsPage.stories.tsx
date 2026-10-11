import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { apiService } from '@/infrastructure/api'
import type { BuiltinAgentDetail, BuiltinAgentSummary, CustomAgentDetail } from '@/shared'
import { AdminAgentsPage } from './AdminAgentsPage'
import { installPlayAdminAuditApi } from '../../playAdminAuditFixtures'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

const sourceAgent: BuiltinAgentSummary = {
    workflow_key: 'world_generation', kind: 'builtin_card', display_name: 'World generator',
    output_mode: 'strict_card_schema', schema_model: 'World', builtin_version: 2,
    graph_version: 'mw-content-world-v2',
}
const sourceDetail: BuiltinAgentDetail = {
    ...sourceAgent, graph_version_prefix: 'mw-content-world',
    editable: {system_message: 'Create vivid worlds with consistent history and tone.',
        prompt_template: '{{handle_parser_input_0}}', json_output: true},
}
const customDetail: CustomAgentDetail = {
    kind: 'custom', workflow_key: 'custom_archive', display_name: 'Archive narrator',
    output_mode: 'markdown', schema_model: null, row_version: 2, has_draft_changes: true,
    current_version_number: 1, latest_version_number: 1, updated_at: '2026-10-09',
    graph_version_prefix: 'mw-custom-archive',
    draft: {...sourceDetail.editable, json_output: false},
    current: {...sourceDetail.editable, json_output: false, version_number: 1,
        graph_version: 'mw-custom-archive-v1', output_mode: 'markdown', schema_model: null},
}

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
    beforeEach: () => {
        const restore = installPlayAdminAuditApi()
        apiService.listAgents = async () => [sourceAgent]
        apiService.getAgent = async () => sourceDetail
        apiService.listAgentVersions = async () => ({ versions: [
            { version_id: '2', version_number: 2, graph_version: 'world-generator-v2', output_mode: 'strict_card_schema', is_current: true, created_at: '2026-09-18', created_by_user_id: 1 },
            { version_id: '1', version_number: 1, graph_version: 'world-generator-v1', output_mode: 'strict_card_schema', is_current: false, created_at: '2026-09-01', created_by_user_id: 1 },
        ] })
        return restore
    },
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Root-only Agent Studio. Built-in workflows are immutable; this story opens the custom-copy flow with the source, editable name, and slug prefilled.',
            },
        },
    },
} satisfies Meta<typeof AdminAgentsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}
export const Loading: Story = { beforeEach: () => { apiService.listAgents = () => new Promise(() => {}) } }
export const Empty: Story = { beforeEach: () => { apiService.listAgents = async () => [] } }
export const LoadError: Story = { beforeEach: () => { apiService.listAgents = async () => { throw new Error('The preview service is temporarily unavailable.') } } }

export const CustomAgent: Story = {
    beforeEach: () => {
        apiService.listAgents = async () => [customDetail]
        apiService.getAgent = async () => customDetail
    },
}
export const Restricted: Story = { decorators: [(Story) => <AuthContext.Provider value={{ ...rootAuth, user: { ...rootAuth.user!, user_type: 'user' } }}><Story /></AuthContext.Provider>] }

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
