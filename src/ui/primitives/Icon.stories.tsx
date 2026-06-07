import type { Meta, StoryObj } from '@storybook/react-vite'
import { Compass, Flame, Scroll, Sparkles, Swords, Wand2 } from 'lucide-react'
import { Icon } from './Icon'

const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Thin wrapper around lucide-react enforcing the Reverie 1.75 stroke. Functional icons only — pass any lucide icon component to `icon`. Color is inherited (`currentColor`).',
      },
    },
  },
  argTypes: {
    icon: { control: false, description: 'Any lucide-react icon component.' },
    size: { control: { type: 'range', min: 12, max: 48, step: 2 } },
    strokeWidth: { control: { type: 'range', min: 1, max: 2.5, step: 0.25 } },
  },
  args: { icon: Flame, size: 24, strokeWidth: 1.75 },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Library: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-5 text-parchment-200">
      {[Flame, Sparkles, Wand2, Scroll, Swords, Compass].map((Glyph, i) => (
        <Icon key={i} icon={Glyph} size={24} />
      ))}
    </div>
  ),
}
