import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { characters } from '@/ui/components/lists/fixtures'
import { CastSelector } from './CastSelector'

const meta = {
  title: 'Creation/CastSelector',
  component: CastSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Multi-select list of the user\'s library characters for the adventure cast. Shows a loading row while loading and an EmptyState CTA when the library is empty.' } },
  },
  decorators: [(Story) => <div className="w-[460px] max-w-full"><Story /></div>],
  argTypes: {
    characters: { control: false },
    selectedIds: { control: false },
    onToggle: { control: false },
    onCreateCharacter: { control: false },
    loading: { control: 'boolean' },
  },
  args: { characters, selectedIds: [], onToggle: () => {}, onCreateCharacter: () => {}, loading: false },
} satisfies Meta<typeof CastSelector>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [ids, setIds] = useState<string[]>([characters[0].id])
  return (
    <CastSelector
      characters={characters}
      selectedIds={ids}
      onToggle={(id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
      onCreateCharacter={() => {}}
      loading={false}
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { characters: [] } }
