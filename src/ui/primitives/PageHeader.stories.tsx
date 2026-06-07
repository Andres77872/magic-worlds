import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'
import { Button } from './Button'
import { Icon } from './Icon'
import { IconTile } from './IconTile'
import { PageHeader } from './PageHeader'

const meta = {
  title: 'Primitives/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The one masthead used across top-level screens (creation studio, dashboard greeting, profile): eyebrow + display title (+ subtitle) on the left, actions on the right. Deliberately glow-free so a short header never reads as a hard-edged box.' } },
  },
  decorators: [(Story) => <div className="mx-auto w-full max-w-[1100px] px-6 py-8"><Story /></div>],
  argTypes: {
    icon: { control: false },
    actions: { control: false },
    eyebrowTone: { control: 'inline-radio', options: ['ember', 'arcane', 'muted'] },
    size: { control: 'inline-radio', options: ['md', 'lg'] },
    as: { control: 'inline-radio', options: ['h1', 'h2'] },
    divider: { control: 'boolean' },
  },
  args: {
    eyebrow: 'Creation',
    title: 'Create Character',
    size: 'md',
  },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const CreationStudio: Story = {
  args: {
    eyebrow: 'Creation',
    title: 'Create Character',
    icon: <IconTile icon={Plus} tone="arcane" size="sm" />,
    divider: true,
    actions: (
      <>
        <Button kind="ghost">Back</Button>
        <Button kind="primary" iconLeft={<Icon icon={Plus} size={16} />}>Create</Button>
      </>
    ),
  },
}

export const DashboardGreeting: Story = {
  args: {
    eyebrow: 'Good evening',
    title: 'Who will you become tonight?',
    size: 'lg',
    actions: <Button kind="primary">Continue: The Ember Coast</Button>,
  },
}

export const WithSubtitle: Story = {
  args: {
    eyebrow: 'Your profile',
    title: 'Andres',
    subtitle: 'Open-source AI roleplay — your cast, your worlds, your scenes.',
    divider: true,
  },
}
