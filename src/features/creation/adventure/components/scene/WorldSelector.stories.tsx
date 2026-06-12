import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { worlds } from '@/ui/components/lists/fixtures'
import { WorldSelector } from './WorldSelector'

const meta = {
  title: 'Creation/WorldSelector',
  component: WorldSelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Single-select world list with a leading "None — freeform setting" option.' } },
  },
  decorators: [(Story) => <div className="w-[460px] max-w-full"><Story /></div>],
  argTypes: {
    worlds: { control: false },
    selectedId: { control: false },
    onSelect: { control: false },
    onCreateWorld: { control: false },
    loading: { control: 'boolean' },
  },
  args: { worlds, onSelect: () => {}, onCreateWorld: () => {}, loading: false },
} satisfies Meta<typeof WorldSelector>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [id, setId] = useState<string | undefined>(worlds[0].id)
  return (
    <WorldSelector worlds={worlds} selectedId={id} onSelect={setId} onCreateWorld={() => {}} loading={false} />
  )
}

export const Default: Story = { render: () => <Demo /> }
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { worlds: [] } }
