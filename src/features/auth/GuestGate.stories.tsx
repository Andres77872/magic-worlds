import type { Meta, StoryObj } from '@storybook/react-vite'
import { Globe2 } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'
import { GuestGate } from './GuestGate'

const meta = {
  title: 'Features/Guest gate',
  component: GuestGate,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'What a signed-out visitor sees instead of a page that only lists their own content: candlelit art previewing the page, a plain explanation, account perks, one ember "create account" action and a quieter sign-in.' } },
  },
  argTypes: {
    kind: { control: 'inline-radio', options: ['library', 'play', 'media', 'notifications'] },
    eyebrow: { control: 'text', description: "The gated page's own nav label." },
    onSignUp: { action: 'sign up' },
    onSignIn: { action: 'sign in' },
    onExplore: { action: 'explore' },
    extraAction: { control: false },
  },
  args: {
    kind: 'library',
    eyebrow: 'Library',
    onSignUp: () => {},
    onSignIn: () => {},
    onExplore: () => {},
  },
} satisfies Meta<typeof GuestGate>

export default meta
type Story = StoryObj<typeof meta>

export const Library: Story = {}
export const Conversations: Story = { args: { kind: 'play', eyebrow: 'Chatroom' } }
export const Media: Story = { args: { kind: 'media', eyebrow: 'Media' } }
export const Notifications: Story = { args: { kind: 'notifications', eyebrow: 'Notifications' } }
export const WithPublicView: Story = {
  args: {
    eyebrow: 'Characters',
    extraAction: (
      <Button variant="ghost" size="sm" iconLeft={<Icon icon={Globe2} size={15} />}>
        Public cards
      </Button>
    ),
  },
}
