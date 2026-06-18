import type { Meta, StoryObj } from '@storybook/react-vite'
import { AssistantMessage } from './AssistantMessage'
import { turn } from './assistantFixtures'

const meta = {
  title: 'Creation/Assistant/Message',
  component: AssistantMessage,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One visible card-assistant turn. The **user** speaks in an ember candlelit bubble; the **assistant** answers in literary `.chat-prose` markdown with a copy affordance for settled raw message content and applied-change badges whenever a tool call mutated the card.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[400px] max-w-full"><Story /></div>],
  argTypes: { turn: { control: false } },
  args: {
    turn: turn({ message: { role: 'user', content: 'Invent a desert world made of glass.' } }),
  },
} satisfies Meta<typeof AssistantMessage>

export default meta
type Story = StoryObj<typeof meta>

/** The user's instruction — right-aligned ember bubble with a mono timestamp. */
export const UserTurn: Story = {}

/** Assistant prose rendered from markdown (bold, lists, italics stay plain emphasis). */
export const AssistantProse: Story = {
  args: {
    turn: turn({
      message: {
        role: 'assistant',
        content:
          'I drafted **The Vitrine Expanse** — an endless sea of fused sand where storms polish the dunes to mirrors.\n\n- **Type:** desert\n- **Triggers:** glass, desert, mirage\n\nWant me to deepen the factions next?',
      },
    }),
  },
}

/** A full-card save (`mw_replace_card`) shows the arcane "Card saved" badge. */
export const CardSaved: Story = {
  args: {
    turn: turn({
      message: { role: 'assistant', content: 'Done — the card is drafted and saved.' },
      appliedChanges: [{ kind: 'replace', cardId: 'world-1', fields: [] }],
    }),
  },
}

/** A targeted patch lists up to four touched fields, then truncates with "+N more". */
export const FieldsPatched: Story = {
  args: {
    turn: turn({
      message: { role: 'assistant', content: 'I tightened the prose and refreshed the metadata.' },
      appliedChanges: [
        { kind: 'patch', cardId: 'world-1', fields: ['name', 'description', 'triggers', 'greeting', 'system instructions'] },
      ],
    }),
  },
}

/** Mid-stream: the arcane dots pulse after the partial prose. */
export const Streaming: Story = {
  args: {
    turn: turn({
      message: { role: 'assistant', status: 'pending', content: 'The dunes shift, and beneath them something' },
      isStreaming: true,
    }),
  },
}

/** Stopped mid-reply (user hit Stop or the wait timed out) — partial text stays, marked. */
export const Interrupted: Story = {
  args: {
    turn: turn({
      message: { role: 'assistant', status: 'pending', content: 'The dunes shift, and beneath them something vast turns over in its sleep' },
      isInterrupted: true,
    }),
  },
}

/** A failed turn renders in blood-tinted error styling. */
export const Failed: Story = {
  args: {
    turn: turn({
      message: { role: 'assistant', status: 'failed', content: 'The assistant is briefly unavailable. Try again in a moment.' },
    }),
  },
}
