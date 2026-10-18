import type { Meta, StoryObj } from '@storybook/react-vite'
import { NovelAssistantRequestState } from './NovelAssistantRequestState'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import type { NovelAssistantPendingTurn } from '../persistence/assistantDraftJournal'
import type { StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'

const pending: NovelAssistantPendingTurn = { requestId: 'fictional-stop', draftSequence: 1, conversationId: 7, stopRequested: true,
    body: { kind: 'novel', message: wire.preview.context.request.message, source: wire.preview.context.request as StoryAssistantContextRequest,
        expected_packet_hash: wire.preview.context.packetHash, expected_prompt_hash: wire.preview.promptHash, expected_conversation_version: 0 },
    llm: { selection: { mode: 'inherit' }, expected_revision_id: wire.preview.profile.revision_id } }
const terminal = { status: 'cancelled' as const, request_id: 'fictional-stop', execution_id: '00000000-0000-4000-8000-000000000001', recovery_required: false as const,
    control: { stop_requested: true, executor_stopped: true, settlement: 'pending' as const, usage: null, usage_complete: false } }
const meta = { title: 'Novel/Assistant request state', component: NovelAssistantRequestState, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Retained request status separates an unconfirmed Stop, confirmed termination and pending usage. These fictional states make no provider or API calls.' } } },
    args: { pending, busy: false, stopping: false, canResume: false, canStop: true, onStop: () => {}, onCheck: () => {}, onResume: () => {} },
} satisfies Meta<typeof NovelAssistantRequestState>
export default meta
type Story = StoryObj<typeof meta>
export const AwaitingStop: Story = {}
export const Stopping: Story = { args: { busy: true, stopping: true, canStop: false } }
export const UsagePending: Story = { args: { pending: { ...pending, terminal } } }
export const UnusedRequest: Story = { args: { pending: null, outcome: { conversationId: 7, result: {
    ...terminal, control: { ...terminal.control, settlement: 'not_used', usage_complete: true } } } } }
