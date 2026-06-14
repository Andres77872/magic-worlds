import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character } from '@/shared'
import { CharacterChatSidebar } from './CharacterChatSidebar'

const lyra: Character = {
  id: 'char-lyra',
  name: 'Lyra Dawnwhisper',
  race: 'Half-elf',
  stats: {},
  description:
    'A ranger with a singed cloak and a debt to the Shardwrights. She speaks to glass the way sailors speak to weather — carefully, and never twice the same way.',
  greeting: '"You took your time. The dunes have been singing all night — listen."',
  image_url: 'https://picsum.photos/seed/reverie-lyra/400/533',
  triggers: ['glass', 'ranger', 'dunes'],
}

const dorn: Character = {
  id: 'char-dorn',
  name: 'Dorn Embervein',
  race: 'Dwarf',
  stats: {},
  description: 'A forge-priest who answers most questions with a proverb and a hammer tap.',
  greeting: 'Keep your voice low. The old iron is listening.',
  image_url: 'https://picsum.photos/seed/reverie-dorn/400/533',
  triggers: ['forge', 'iron', 'priest'],
}

const aria: Character = {
  id: 'persona-aria',
  name: 'Aria Vale',
  role: 'persona',
  race: 'Human',
  stats: {},
  description: 'A careful wanderer with a map full of deliberate blank spaces.',
  triggers: ['traveler'],
}

const meta = {
  title: 'Features/CharacterChat/Sidebar',
  component: CharacterChatSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Read-only sidebar for the 1:1 character chat screen (the arcane Chat mode). Shows the portrait, identity, and greeting; editing lives in the creator via "Edit character" — a chat doesn\'t need the adventure left panel\'s snapshot-card machinery.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[640px] w-[300px] overflow-hidden rounded-xl border border-parchment-50/10">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    character: { control: false },
    characters: { control: false },
    persona: { control: false },
    onBack: { control: false },
    onEditCharacter: { control: false },
  },
  args: { character: lyra, onBack: () => {}, onEditCharacter: () => {} },
} satisfies Meta<typeof CharacterChatSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** No portrait yet — the warm deterministic gradient stands in. */
export const NoPortrait: Story = {
  args: { character: { ...lyra, image_url: undefined } },
}

export const GroupChat: Story = {
  args: {
    character: undefined,
    characters: [lyra, dorn],
    title: 'Lyra & Dorn',
    isGroup: true,
    persona: aria,
  },
}
