import type { Meta, StoryObj } from '@storybook/react-vite'
import { CharacterChatList } from './CharacterChatList'
import { characterChats } from './fixtures'

const meta = {
  title: 'Components/Lists/CharacterChatList',
  component: CharacterChatList,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Recent 1:1 character chats: resume/delete actions, the Chat mode badge, and the last spoken line. Clicking a card resumes the conversation where it left off.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    chats: { control: false },
    onResume: { control: false },
    onDelete: { control: false },
    loading: { control: 'boolean' },
  },
  args: { chats: characterChats, loading: false, onResume: () => {}, onDelete: async () => {} },
} satisfies Meta<typeof CharacterChatList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Rail: Story = { args: { layout: 'rail' } }
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { chats: [] } }
