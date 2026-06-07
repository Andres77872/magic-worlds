import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatAvatar } from './ChatAvatar'

const meta = {
  title: 'Interaction/ChatAvatar',
  component: ChatAvatar,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Turn avatar — the player gets an ember ring, the Game Master an arcane ring.' } },
  },
  argTypes: { isUser: { control: 'boolean' } },
  args: { isUser: false },
} satisfies Meta<typeof ChatAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const GameMaster: Story = { args: { isUser: false } }
export const Player: Story = { args: { isUser: true } }

export const BothRings: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-6">
      <ChatAvatar isUser />
      <ChatAvatar isUser={false} />
    </div>
  ),
}
