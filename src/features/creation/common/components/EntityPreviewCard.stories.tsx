import type { Meta, StoryObj } from '@storybook/react-vite'
import { EntityPreviewCard } from './EntityPreviewCard'

const meta = {
  title: 'Creation/EntityPreviewCard',
  component: EntityPreviewCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The live "card" preview shared by the Character and World creators. Renders the real domain Card from live form state — name-seeded portrait, race/type tag, top filled attributes, clamped description, and trigger chips.' } },
  },
  decorators: [(Story) => <div className="w-72 max-w-full"><Story /></div>],
  argTypes: {
    name: { control: 'text' },
    badge: { control: 'text' },
    description: { control: 'text' },
    unnamedLabel: { control: false },
    badgePlaceholder: { control: false },
    triggers: { control: false },
    attributes: { control: false },
    categories: { control: false },
  },
  args: {
    name: 'Lyra Dawnwhisper',
    unnamedLabel: 'Unnamed Character',
    badge: 'Half-elf',
    badgePlaceholder: 'Add a race…',
    description: 'A wandering bard whose songs are rumored to bend luck — and the occasional lock.',
    triggers: ['bard', 'silver tongue', 'the tavern'],
    categories: [{ id: 'stats', name: 'Stats', type: 'stat', description: '' }],
    attributes: {
      stats: [
        { key: 'Charisma', value: '17' },
        { key: 'Dexterity', value: '14' },
      ],
    },
  },
} satisfies Meta<typeof EntityPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

/** A filled-in card. */
export const Filled: Story = {}

/** Before anything is typed — placeholder title + prompt. */
export const Empty: Story = {
  args: { name: '', badge: '', description: '', triggers: [], categories: [], attributes: {} },
}
