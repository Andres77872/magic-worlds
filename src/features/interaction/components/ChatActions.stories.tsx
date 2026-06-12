import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatActions } from './ChatActions'

const meta = {
  title: 'Interaction/ChatActions',
  component: ChatActions,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Per-turn action buttons. Player turns can be edited/deleted; Game Master turns add regenerate. All hide while streaming or editing.' } },
  },
  argTypes: {
    turnId: { control: false },
    isUser: { control: 'boolean' },
    isEditing: { control: 'boolean' },
    isStreaming: { control: 'boolean' },
    onEditClick: { action: 'edit' },
    onRegenerateClick: { action: 'regenerate' },
    onDeleteClick: { action: 'delete' },
  },
  args: { turnId: 't1', isUser: false, isEditing: false, isStreaming: false },
} satisfies Meta<typeof ChatActions>

export default meta
type Story = StoryObj<typeof meta>

/** Game Master turn — edit, regenerate, delete. */
export const GameMaster: Story = {}

/** Player turn — edit + delete (no regenerate). */
export const Player: Story = { args: { isUser: true } }

/** While the reply streams, actions are hidden. */
export const Streaming: Story = { args: { isStreaming: true } }
