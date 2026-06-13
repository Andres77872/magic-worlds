import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Adventure, Character, Item, Story as NovelStory, World } from '@/shared'
import type { ResumeSession } from './resumeModel'
import { searchDashboard } from './searchModel'
import { toScene } from './sceneModel'
import { SearchResults } from './SearchResults'

const SESSIONS: ResumeSession[] = [
  {
    kind: 'adventure',
    id: 'a1',
    title: 'The Ember Road',
    context: 'The Hollow Wood',
    snippet: 'The campfire answers before you do.',
    meta: '14 turns · 2 hr. ago',
    updatedAtMs: 0,
    source: { id: 'a1' } as ResumeSession['source'],
  },
  {
    kind: 'chat',
    id: 'c1',
    title: 'Emberlyn',
    context: 'human',
    snippet: 'You still owe me a story, you know.',
    meta: '32 messages · yesterday',
    updatedAtMs: 0,
    source: { id: 'c1' } as ResumeSession['source'],
  },
]

const TEMPLATES = [
  { id: 't1', scenario: 'Ashes over the Ember Coast', characters: [], turns: [], triggers: ['Mystery'] },
  { id: 't2', scenario: 'The Emberwright\'s Apprentice', characters: [], turns: [], triggers: ['Folk'] },
] as unknown as Adventure[]

const CAST = [
  { id: 'ch1', name: 'Emberlyn', race: 'Human', stats: {}, triggers: ['hearth'] },
] as unknown as Character[]

const WORLDS = [
  { id: 'w1', name: 'The Ember Coast', type: 'coastline', details: {}, triggers: [] },
] as unknown as World[]

const ITEMS = [
  { id: 'i1', name: 'Ember Lantern', rarity: 'Rare', description: '', effects: [], requirements: [], limitations: [] },
] as unknown as Item[]

const NOVELS = [
  { id: 's1', title: 'Embers of the Long Night', scenes: [], activeCardRefs: [], activeContext: {} },
] as unknown as NovelStory[]

const INPUT = {
  sessions: SESSIONS,
  scenes: TEMPLATES.map(toScene),
  cast: CAST,
  personas: [],
  worlds: WORLDS,
  items: ITEMS,
  stories: NOVELS,
}

const noop = () => {}
const handlers = {
  onClear: noop,
  onOpenSession: noop,
  onBeginTemplate: noop,
  onChatCharacter: noop,
  onEditCharacter: noop,
  onEditWorld: noop,
  onEditItem: noop,
  onOpenStory: noop,
  onCreateAdventure: noop,
  onViewGallery: noop,
}

const meta = {
  title: 'Landing/SearchResults',
  component: SearchResults,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: "The dashboard's search state — grouped cross-section matches, each group rendered with its zone's own card language (resume rows, portrait gallery cards, story tiles)." } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: { results: { control: false } },
  args: {
    results: searchDashboard('ember', INPUT),
    ...handlers,
  },
} satisfies Meta<typeof SearchResults>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoMatches: Story = {
  args: { results: searchDashboard('zeppelin', INPUT) },
}
