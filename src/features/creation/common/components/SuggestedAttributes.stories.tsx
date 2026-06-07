import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SuggestedAttributes } from './SuggestedAttributes'

const meta = {
  title: 'Creation/SuggestedAttributes',
  component: SuggestedAttributes,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'One-click preset chips that append a prefilled attribute row. A preset already present shows as done (checked + disabled).' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    presets: { control: false },
    existingKeys: { control: false },
    onAdd: { control: false },
  },
  args: { presets: [], existingKeys: [], onAdd: () => {} },
} satisfies Meta<typeof SuggestedAttributes>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [keys, setKeys] = useState<string[]>(['strength'])
  return (
    <SuggestedAttributes
      presets={[{ key: 'Strength' }, { key: 'Dexterity' }, { key: 'Charisma' }, { key: 'Lore' }, { key: 'Resolve' }]}
      existingKeys={keys}
      onAdd={(p) => setKeys((k) => [...k, p.key.toLowerCase()])}
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
