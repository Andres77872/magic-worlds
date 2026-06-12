import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Chip } from './Chip'

const meta = {
  title: 'Primitives/Chip',
  component: Chip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Interactive filter pill. `active` lights it ember. Use `Tag` for static, non-interactive labels.',
      },
    },
  },
  argTypes: {
    active: { control: 'boolean' },
    icon: { control: false },
    children: { control: 'text' },
    onClick: { action: 'clicked' },
  },
  args: { active: false, children: 'Fantasy' },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Active: Story = { args: { active: true } }

const FILTERS = ['All', 'Fantasy', 'Sci-fi', 'Mystery', 'Romance']

function FilterRow() {
  const [active, setActive] = useState('All')
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <Chip key={f} active={f === active} onClick={() => setActive(f)}>
          {f}
        </Chip>
      ))}
    </div>
  )
}

/** A real filter bar — only one chip active at a time. */
export const FilterBar: Story = {
  parameters: { controls: { disable: true } },
  render: () => <FilterRow />,
}
