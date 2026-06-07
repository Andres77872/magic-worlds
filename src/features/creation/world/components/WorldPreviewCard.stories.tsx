import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorldPreviewCard } from './WorldPreviewCard'

const meta = {
  title: 'Creation/WorldPreviewCard',
  component: WorldPreviewCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Live preview of the world being created — a thin wrapper over EntityPreviewCard.' } },
  },
  decorators: [(Story) => <div className="w-72 max-w-full"><Story /></div>],
  argTypes: {
    name: { control: 'text' },
    type: { control: 'text' },
    description: { control: 'text' },
    triggers: { control: false },
    attributes: { control: false },
    categories: { control: false },
  },
  args: {
    name: 'The Sunken Library',
    type: 'fantasy',
    description: 'A drowned archive where every book remembers being read, and the ink still whispers.',
    triggers: ['library', 'drowned', 'ink'],
    categories: [{ id: 'details', name: 'Details', type: 'detail', description: '' }],
    attributes: { details: [{ key: 'Era', value: 'Forgotten age' }, { key: 'Mood', value: 'Hushed, wet' }] },
  },
} satisfies Meta<typeof WorldPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Filled: Story = {}
export const Empty: Story = {
  args: { name: '', type: '', description: '', triggers: [], categories: [], attributes: {} },
}
