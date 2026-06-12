import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '@/ui/primitives'
import { CastMemberCard } from './CastMemberCard'

const meta = {
  title: 'Creation/CastMemberCard',
  component: CastMemberCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'A selectable cast/persona/world row: avatar, name + type tag, description, and a check (multi-select) or radio (single-select) indicator. Ember ring when selected.' } },
  },
  decorators: [(Story) => <div className="w-[420px] max-w-full"><Story /></div>],
  argTypes: {
    name: { control: 'text' },
    race: { control: 'text' },
    description: { control: 'text' },
    selected: { control: 'boolean' },
    mode: { control: 'inline-radio', options: ['check', 'radio'] },
    onToggle: { control: false },
    badge: { control: false },
  },
  args: {
    name: 'Lyra Dawnwhisper',
    race: 'Half-elf',
    description: 'A wandering bard whose songs bend luck — and the occasional lock.',
    selected: false,
    mode: 'check',
    onToggle: () => {},
  },
} satisfies Meta<typeof CastMemberCard>

export default meta
type Story = StoryObj<typeof meta>

export const Unselected: Story = {}
export const Selected: Story = { args: { selected: true } }
export const RadioMode: Story = { args: { mode: 'radio' } }
export const Persona: Story = { args: { selected: true, mode: 'radio', badge: <Badge tone="ember">You</Badge> } }
