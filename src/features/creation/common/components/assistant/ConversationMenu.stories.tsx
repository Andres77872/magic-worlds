import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConversationMenu } from './ConversationMenu'
import { SAMPLE_CONVERSATIONS } from './assistantFixtures'

const meta = {
  title: 'Creation/Assistant/ConversationMenu',
  component: ConversationMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The history popover behind the header\'s clock icon. **Click the icon to open it.** "New chat" resets locally (the server conversation is created lazily on the first send, so empty chats never pile up); rows show relative times and reveal a trash icon on hover that turns into an inline "Delete?" confirm. Untitled rows fall back to "Conversation N".',
      },
    },
  },
  // Anchor the trigger top-right so the popover has room to drop, mirroring the panel header.
  decorators: [
    (Story) => (
      <div className="flex h-[360px] w-[400px] justify-end rounded-xl border border-parchment-50/10 bg-ink-800 p-3">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    conversations: { control: false },
    activeId: { control: false },
    onSelect: { control: false },
    onNew: { control: false },
    onDelete: { control: false },
  },
  args: {
    conversations: SAMPLE_CONVERSATIONS,
    activeId: 1,
    disabled: false,
    onSelect: () => {},
    onNew: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof ConversationMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Three past chats; the active one is ember-lit with a check. Click the icon to open. */
export const Default: Story = {}

/** No history yet — only "New chat" and an empty hint. */
export const Empty: Story = {
  args: { conversations: [], activeId: null },
}

/** Disabled while a reply is streaming or a switch is loading. */
export const Disabled: Story = {
  args: { disabled: true },
}
