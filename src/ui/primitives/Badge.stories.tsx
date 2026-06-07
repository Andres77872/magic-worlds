import type { Meta, StoryObj } from '@storybook/react-vite'
import { Flame, Sparkles } from 'lucide-react'
import { Badge } from './Badge'

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Compact status pill. `ember` = highlight, `arcane` = AI, `live` = success, `nsfw` = danger, `neutral` = quiet, `glass` = translucent over imagery.',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['ember', 'arcane', 'live', 'nsfw', 'neutral', 'glass'],
    },
    icon: { control: false },
    children: { control: 'text' },
  },
  args: { tone: 'ember', children: 'Featured' },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Ember: Story = {}
export const Arcane: Story = { args: { tone: 'arcane', children: 'AI', icon: <Sparkles size={12} strokeWidth={2} /> } }
export const Live: Story = { args: { tone: 'live', children: 'Live' } }
export const Nsfw: Story = { args: { tone: 'nsfw', children: 'NSFW' } }
export const Neutral: Story = { args: { tone: 'neutral', children: 'Draft' } }

export const AllTones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="ember" icon={<Flame size={12} strokeWidth={2} />}>Featured</Badge>
      <Badge tone="arcane" icon={<Sparkles size={12} strokeWidth={2} />}>AI</Badge>
      <Badge tone="live">Live</Badge>
      <Badge tone="nsfw">NSFW</Badge>
      <Badge tone="neutral">Draft</Badge>
      <Badge tone="glass">Glass</Badge>
    </div>
  ),
}
