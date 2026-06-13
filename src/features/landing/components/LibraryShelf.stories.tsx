import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character, Item, Story, World } from '@/shared'
import { LibraryShelf } from './LibraryShelf'

const PERSONAS = [
  { id: 'p1', name: 'Ash', race: 'Human', stats: {}, is_default_persona: true, triggers: ['wanderer'] },
  { id: 'p2', name: 'Mara', race: 'Elf', stats: {}, triggers: [] },
] as unknown as Character[]

const WORLDS = [
  { id: 'w1', name: 'The Hollow Wood', type: 'forest', place_type: 'wild', details: {}, triggers: ['fey'] },
] as unknown as World[]

const ITEMS = [
  { id: 'i1', name: 'Unsent Letter', type: 'keepsake', rarity: 'Unique', description: '', effects: [], requirements: [], limitations: [] },
] as unknown as Item[]

const STORIES = [
  { id: 's1', title: 'The Long Night', description: 'A vigil that should have lasted one evening.', scenes: [], activeCardRefs: [], activeContext: {} },
] as unknown as Story[]

const meta = {
  title: 'Landing/LibraryShelf',
  component: LibraryShelf,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The quiet "your library" band — chip tabs with counts switch one compact image-forward rail between personas, worlds, items, and novels.' } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: {
    onEditCharacter: { control: false }, onDeleteCharacter: { control: false },
    onEditWorld: { control: false }, onDeleteWorld: { control: false },
    onEditItem: { control: false }, onDeleteItem: { control: false },
    onOpenStory: { control: false }, onViewAll: { control: false }, onCreate: { control: false },
  },
  args: {
    personas: PERSONAS,
    worlds: WORLDS,
    items: ITEMS,
    stories: STORIES,
    onEditCharacter: () => {},
    onDeleteCharacter: () => {},
    onEditWorld: () => {},
    onDeleteWorld: () => {},
    onEditItem: () => {},
    onDeleteItem: () => {},
    onOpenStory: () => {},
    onViewAll: () => {},
    onCreate: () => {},
  },
} satisfies Meta<typeof LibraryShelf>

export default meta
type ShelfStory = StoryObj<typeof meta>

export const Default: ShelfStory = {}

export const SparseAccount: ShelfStory = {
  args: { personas: [], worlds: [], items: [], stories: [] },
}
