import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { FilterChips } from './FilterChips'

const meta = {
  title: 'Landing/FilterChips',
  component: FilterChips,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Genre filter row for the scene gallery — "All" plus tags derived from the user\'s own templates. Renders nothing when there are no options.' } },
  },
  decorators: [(Story) => <div className="w-[640px] max-w-full"><Story /></div>],
  argTypes: {
    options: { control: false },
    active: { control: false },
    onChange: { control: false },
  },
  args: { options: [], active: 'All', onChange: () => {} },
} satisfies Meta<typeof FilterChips>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [active, setActive] = useState('All')
  return <FilterChips options={['Fantasy', 'Sci-fi', 'Mystery', 'Romance']} active={active} onChange={setActive} />
}

export const Default: Story = { render: () => <Demo /> }
