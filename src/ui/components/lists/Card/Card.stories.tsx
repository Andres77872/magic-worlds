import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pencil, Trash2 } from 'lucide-react'
import { Icon, Tag } from '@/ui/primitives'
import { Card } from './Card'
import type { CardOption } from './CardOptions'

const options: CardOption[] = [
  { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: 'Edit', onClick: () => {} },
  { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: 'Delete', onClick: () => {}, danger: true },
]

const meta = {
  title: 'Components/Lists/Card',
  component: Card,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-72"><Story /></div>],
  parameters: {
    docs: { description: { component: 'Domain card: a Reverie surface with a Portrait header (the title seeds the gradient + initial), a narrative subtitle, an actions menu, and body content. Handles hover-lift, highlight, loading, and disabled states.' } },
  },
  argTypes: {
    title: { control: 'text' },
    highlight: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    subtitle: { control: false },
    options: { control: false },
    children: { control: false },
    onClick: { action: 'clicked' },
  },
  args: { title: 'Lyra Dawnwhisper', highlight: false, isLoading: false, disabled: false },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Card {...args} subtitle={<Tag>Half-elf</Tag>} options={options}>
      <div className="font-narrative text-sm italic text-parchment-400">Charisma: 17 • Dexterity: 14</div>
    </Card>
  ),
}

export const Highlighted: Story = {
  args: { highlight: true },
  render: (args) => (
    <Card {...args} subtitle={<Tag>Half-elf</Tag>} options={options}>
      <div className="font-narrative text-sm italic text-parchment-400">Your active companion</div>
    </Card>
  ),
}

export const Loading: Story = {
  args: { isLoading: true },
  render: (args) => (
    <Card {...args} subtitle={<Tag>Half-elf</Tag>}>
      <div className="font-narrative text-sm italic text-parchment-400">Charisma: 17 • Dexterity: 14</div>
    </Card>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Card {...args} subtitle={<Tag>Half-elf</Tag>} options={options}>
      <div className="font-narrative text-sm italic text-parchment-400">Unavailable</div>
    </Card>
  ),
}
