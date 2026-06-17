import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatActions } from './ChatActions'

const meta = {
  title: 'Interaction/ChatActions',
  component: ChatActions,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Per-turn action buttons. All completed turns can copy raw message content; player turns can be edited/deleted; Game Master turns add regenerate. Mutating actions hide while streaming, editing, or globally busy.' } },
  },
  argTypes: {
    turnId: { control: false },
    isUser: { control: 'boolean' },
    isEditing: { control: 'boolean' },
    isStreaming: { control: 'boolean' },
    actionsDisabled: { control: 'boolean' },
    messageContent: { control: 'text' },
    onEditClick: { action: 'edit' },
    onRegenerateClick: { action: 'regenerate' },
    onDeleteClick: { action: 'delete' },
  },
  args: {
    turnId: 't1',
    isUser: false,
    isEditing: false,
    isStreaming: false,
    actionsDisabled: false,
    messageContent: `The hooded figure slides a damp envelope across the table. "Read it here," she says.`,
  },
} satisfies Meta<typeof ChatActions>

export default meta
type Story = StoryObj<typeof meta>

/** Game Master turn — edit, regenerate, delete. */
export const GameMaster: Story = {}

/** Player turn — edit + delete (no regenerate). */
export const Player: Story = { args: { isUser: true } }

/** While the reply streams, actions are hidden. */
export const Streaming: Story = { args: { isStreaming: true } }

/** During unrelated busy states, copy stays available while mutating actions are hidden. */
export const BusyButCopyable: Story = { args: { actionsDisabled: true } }
