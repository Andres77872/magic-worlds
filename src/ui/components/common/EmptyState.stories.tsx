import type { Meta, StoryObj } from '@storybook/react-vite'
import { Compass, Users } from 'lucide-react'
import { Icon } from '@/ui/primitives'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Dashed-border placeholder for empty collections — an optional icon, a message, secondary text, and a primary call-to-action.' } },
  },
  decorators: [(Story) => <div className="w-[560px]"><Story /></div>],
  argTypes: {
    message: { control: 'text' },
    secondaryText: { control: 'text' },
    icon: { control: false },
    button: { control: false },
  },
  args: { message: 'No characters created yet' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { secondaryText: 'Your cast is empty. Conjure someone to step into a scene with.' },
}

export const WithIcon: Story = {
  args: {
    icon: <Icon icon={Users} size={32} />,
    secondaryText: 'Your cast is empty. Conjure someone to step into a scene with.',
  },
}

export const WithAction: Story = {
  args: {
    icon: <Icon icon={Compass} size={32} />,
    message: 'No adventures in progress',
    secondaryText: 'Start a new adventure from a template and your story will appear here.',
    button: { label: 'Browse templates', onClick: () => {} },
  },
}
