import type { Meta, StoryObj } from '@storybook/react-vite'
import { AssistantMessageList } from './AssistantMessageList'
import { SAMPLE_CONVERSATION_TURNS, turn } from './assistantFixtures'
import { ASSISTANT_SUGGESTIONS } from './suggestions'

const meta = {
  title: 'Creation/Assistant/MessageList',
  component: AssistantMessageList,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The assistant panel\'s scroll region. Sticks to the bottom while streaming (only when the reader is already at the bottom), masks stale turns with a shimmer skeleton while switching conversations, and greets an empty chat with per-card-type starter suggestion chips that send their prompt in one tap.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex h-[480px] w-[400px] flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    turns: { control: false },
    suggestions: { control: false },
    onSuggestion: { control: false },
    conversationKey: { control: false },
    status: { control: 'inline-radio', options: ['idle', 'initializing', 'switching', 'streaming'] },
  },
  args: {
    turns: SAMPLE_CONVERSATION_TURNS,
    status: 'idle',
    suggestions: ASSISTANT_SUGGESTIONS.world,
    onSuggestion: () => {},
    conversationKey: 1,
  },
} satisfies Meta<typeof AssistantMessageList>

export default meta
type Story = StoryObj<typeof meta>

/** A settled conversation with applied-change badges on assistant turns. */
export const Conversation: Story = {}

/** No messages yet — the empty state offers per-card-type starter prompts. */
export const EmptyWithSuggestions: Story = {
  args: { turns: [], conversationKey: null },
}

/** "Thinking" — the request is in flight but no delta has arrived yet. */
export const Thinking: Story = {
  args: {
    turns: [turn({ message: { role: 'user', content: 'Raise the stakes of the final act.' } })],
    status: 'streaming',
  },
}

/** A reply streaming in, dots pulsing at the tail of the prose. */
export const Streaming: Story = {
  args: {
    turns: [
      turn({ message: { role: 'user', content: 'Describe the glass storms.' } }),
      turn({
        message: { role: 'assistant', status: 'pending', content: 'When the wind rises, the dunes *sing* — a thousand panes vibrating' },
        isStreaming: true,
      }),
    ],
    status: 'streaming',
  },
}

/** Switching conversations masks stale turns with the shimmer skeleton. */
export const SwitchingSkeleton: Story = {
  args: { status: 'switching' },
}
