import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sparkles, Swords } from 'lucide-react'
import { SectionHeader } from './SectionHeader'
import { Badge } from './Badge'

const meta = {
  title: 'Primitives/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="w-[420px]"><Story /></div>],
  argTypes: {
    title: { control: 'text' },
    tone: { control: 'inline-radio', options: ['ember', 'arcane'] },
    icon: { control: false },
    right: { control: false },
  },
  args: { title: 'Your characters', icon: Swords, tone: 'ember' },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Arcane: Story = { args: { title: 'AI suggestions', icon: Sparkles, tone: 'arcane' } }

export const WithAction: Story = {
  args: { title: 'Featured worlds', icon: Swords, right: <Badge tone="neutral">12</Badge> },
}
