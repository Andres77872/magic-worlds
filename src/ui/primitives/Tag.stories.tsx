import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tag } from './Tag'

const meta = {
  title: 'Primitives/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Static, non-interactive label pill (e.g. traits, attributes). Use `Chip` for interactive filters.',
      },
    },
  },
  argTypes: { children: { control: 'text' } },
  args: { children: 'Elf' },
} satisfies Meta<typeof Tag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Group: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag>Elf</Tag>
      <Tag>Ranger</Tag>
      <Tag>Chaotic good</Tag>
      <Tag>Level 7</Tag>
    </div>
  ),
}
