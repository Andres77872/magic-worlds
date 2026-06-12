import type { Meta, StoryObj } from '@storybook/react-vite'
import { CharacterPreviewCard } from './CharacterPreviewCard'

const meta = {
  title: 'Creation/CharacterPreviewCard',
  component: CharacterPreviewCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Live preview of the character being created — a thin wrapper over EntityPreviewCard rendering the real domain Card from form state.' } },
  },
  decorators: [(Story) => <div className="w-72 max-w-full"><Story /></div>],
  argTypes: {
    name: { control: 'text' },
    race: { control: 'text' },
    description: { control: 'text' },
    triggers: { control: false },
    attributes: { control: false },
    categories: { control: false },
  },
  args: {
    name: 'Lyra Dawnwhisper',
    race: 'Half-elf',
    description: 'A wandering bard whose songs are rumored to bend luck — and the occasional lock.',
    triggers: ['bard', 'silver tongue'],
    categories: [{ id: 'stats', name: 'Stats', type: 'stat', description: '' }],
    attributes: { stats: [{ key: 'Charisma', value: '17' }, { key: 'Dexterity', value: '14' }] },
  },
} satisfies Meta<typeof CharacterPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Filled: Story = {}
export const Empty: Story = {
  args: { name: '', race: '', description: '', triggers: [], categories: [], attributes: {} },
}
