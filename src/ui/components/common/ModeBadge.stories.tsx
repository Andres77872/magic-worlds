import type { Meta, StoryObj } from '@storybook/react-vite'
import { ModeBadge } from './ModeBadge'

const meta = {
  title: 'Components/Common/ModeBadge',
  component: ModeBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: { description: { component: 'Tags a card, shelf, or screen with its play mode — Adventure (Swords/ember, Game Master–led role-play) or Chat (MessageCircle/arcane, 1:1 conversation). Driven by MODE_META.' } },
  },
  argTypes: {
    mode: { control: 'radio', options: ['adventure', 'chat'] },
    compact: { control: 'boolean' },
  },
  args: { mode: 'adventure' },
} satisfies Meta<typeof ModeBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Adventure: Story = {}

export const Chat: Story = {
  args: { mode: 'chat' },
}

export const Compact: Story = {
  args: { compact: true },
}
