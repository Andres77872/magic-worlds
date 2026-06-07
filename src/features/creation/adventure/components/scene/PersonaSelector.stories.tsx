import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { characters } from '@/ui/components/lists/fixtures'
import { PersonaSelector } from './PersonaSelector'

const meta = {
  title: 'Creation/PersonaSelector',
  component: PersonaSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Single-select "Play as…" list with a leading "None — observe" option. The chosen character is marked "You".' } },
  },
  decorators: [(Story) => <div className="w-[460px] max-w-full"><Story /></div>],
  argTypes: {
    characters: { control: false },
    selectedId: { control: false },
    onSelect: { control: false },
    onCreateCharacter: { control: false },
    loading: { control: 'boolean' },
  },
  args: { characters, onSelect: () => {}, onCreateCharacter: () => {}, loading: false },
} satisfies Meta<typeof PersonaSelector>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [id, setId] = useState<string | undefined>(characters[0].id)
  return (
    <PersonaSelector
      characters={characters}
      selectedId={id}
      onSelect={setId}
      onCreateCharacter={() => {}}
      loading={false}
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { characters: [] } }
