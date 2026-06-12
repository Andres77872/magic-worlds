import type { Meta, StoryObj } from '@storybook/react-vite'
import { EditMode } from './EditMode'

const meta = {
  title: 'Interaction/EditMode',
  component: EditMode,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Inline editor for a turn. Ctrl/Cmd+Enter saves, Escape cancels. Player edits get a short box; Game Master edits get a taller markdown box.' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    initialContent: { control: 'text' },
    isUser: { control: 'boolean' },
    onSave: { control: false },
    onCancel: { control: false },
  },
  args: {
    initialContent: 'I take the seat across from her and keep my hood up.',
    isUser: true,
    onSave: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof EditMode>

export default meta
type Story = StoryObj<typeof meta>

export const PlayerEdit: Story = {}

export const GameMasterEdit: Story = {
  args: {
    isUser: false,
    initialContent: 'She slides a damp envelope across the table. "Read it here. Not on the road."',
  },
}
