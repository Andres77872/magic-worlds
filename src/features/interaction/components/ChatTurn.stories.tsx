import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TurnEntry } from '../../../shared'
import { ChatTurn } from './ChatTurn'

// Mirrors ChatTurn's local ExtendedTurnEntry shape.
type DemoTurn = TurnEntry & {
  forwardOptions?: { label: string; message: string }[]
  isStreaming?: boolean
  imagePrompt?: string
}

const gmTurn: DemoTurn = {
  id: 't-ai-1',
  type: 'ai',
  content: `The hooded figure slides a damp envelope across the table. "Read it here," she says. *Her eyes never leave the door.* **She doesn't trust the road either.**`,
  timestamp: '2026-06-06T21:47:00Z',
  forwardOptions: [
    { label: 'Open the envelope', message: 'Open the envelope now and read what is inside.' },
    { label: 'Ask who sent it', message: 'Ask the hooded figure who sent the message.' },
  ],
}

const userTurn: DemoTurn = {
  id: 't-user-1',
  type: 'user',
  content: 'I take the seat across from her and keep my hood up.',
  timestamp: '2026-06-06T21:46:00Z',
}

const structuredTurn: DemoTurn = {
  ...gmTurn,
  id: 't-ai-structured',
  content: 'Lyra: The door listens.',
  segments: [
    { kind: 'narrator', content: 'The tavern hushes as rain taps against the leaded glass.' },
    { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: '"The door listens," she says. "Ask it gently."' },
    { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'It remembers my hands on the old lock.' },
  ],
}

const meta = {
  title: 'Interaction/ChatTurn',
  component: ChatTurn,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'A full turn row: avatar, role eyebrow + timestamp, actions, the message (player bubble or GM prose), and any suggested forward options. Composes ChatAvatar, ChatMessage, ChatActions, ForwardOptions and EditMode.' } },
  },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  argTypes: {
    turn: { control: false },
    onForwardOptionClick: { control: false },
    onRegenerateClick: { control: false },
    onDeleteClick: { control: false },
    onEditClick: { control: false },
  },
  args: {
    turn: gmTurn,
    onForwardOptionClick: () => {},
    onRegenerateClick: () => {},
    onDeleteClick: () => {},
    onEditClick: () => {},
  },
} satisfies Meta<typeof ChatTurn>

export default meta
type Story = StoryObj<typeof meta>

/** Game Master turn with suggested forward options. */
export const GameMasterTurn: Story = {}

/** Player turn — ember bubble, right-aligned. */
export const PlayerTurn: Story = { args: { turn: userTurn } }

/** Parsed XML segments with narrator, speech, and visible thought blocks. */
export const StructuredSegments: Story = { args: { turn: structuredTurn } }

/** Streaming — actions are hidden and the thinking dots show. */
export const Streaming: Story = { args: { turn: { ...gmTurn, forwardOptions: undefined, isStreaming: true } } }
