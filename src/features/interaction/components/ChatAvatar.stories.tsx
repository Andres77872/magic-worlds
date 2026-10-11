import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatAvatar } from './ChatAvatar'

const meta = {
  title: 'Interaction/ChatAvatar',
  component: ChatAvatar,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Turn avatar — the player gets an ember ring, the AI an arcane ring: the Game Master glyph, or a 1:1 character\'s own portrait and initial. The ring pulses while a reply is written.' } },
  },
  argTypes: { isUser: { control: 'boolean' }, thinking: { control: 'boolean' }, aiName: { control: 'text' } },
  args: { isUser: false },
} satisfies Meta<typeof ChatAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const GameMaster: Story = { args: { isUser: false } }
export const Player: Story = { args: { isUser: true } }
export const Character: Story = { args: { aiName: 'Kai' } }
export const Writing: Story = { args: { aiName: 'Kai', thinking: true } }

export const BothRings: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-6">
      <ChatAvatar isUser />
      <ChatAvatar isUser={false} />
    </div>
  ),
}
