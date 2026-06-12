import type { Meta, StoryObj } from '@storybook/react-vite'
import { Globe, Sparkles, Swords, Users } from 'lucide-react'
import { IconTile } from './IconTile'

const meta = {
  title: 'Primitives/IconTile',
  component: IconTile,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'A square, tinted glyph plate that anchors section headers, create/feature cards, and empty states. Ember by default; arcane for AI/magic. Pass `glow` to light it up on a parent `group` hover.' } },
  },
  argTypes: {
    icon: { control: false },
    tone: { control: 'inline-radio', options: ['ember', 'arcane'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    glow: { control: 'boolean' },
  },
  args: { icon: Users, tone: 'ember', size: 'md', glow: false },
} satisfies Meta<typeof IconTile>

export default meta
type Story = StoryObj<typeof meta>

export const Ember: Story = {}

export const Arcane: Story = {
  args: { icon: Sparkles, tone: 'arcane' },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <IconTile icon={Users} size="sm" />
      <IconTile icon={Globe} size="md" />
      <IconTile icon={Swords} size="lg" />
    </div>
  ),
}

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IconTile icon={Swords} tone="ember" />
      <IconTile icon={Sparkles} tone="arcane" />
    </div>
  ),
}

export const GlowOnHover: Story = {
  render: () => (
    <div className="group cursor-pointer rounded-xl border border-parchment-50/10 bg-ink-700 p-6">
      <IconTile icon={Sparkles} tone="arcane" glow />
      <p className="mt-3 font-ui text-sm text-parchment-400">Hover the card — the tile glows.</p>
    </div>
  ),
}
