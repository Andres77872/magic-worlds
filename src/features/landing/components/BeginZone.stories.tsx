import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Adventure } from '@/shared'
import { toScene } from './sceneModel'
import { BeginZone } from './BeginZone'

const TEMPLATES = [
  { id: 'a1', scenario: 'The Tavern at the Edge of Sleep', triggers: ['Mystery'], characters: [], turns: [], world: { id: 'w1', name: 'The Hollow Wood', type: 'forest', details: {} } },
  { id: 'a2', scenario: 'A Letter Never Sent', triggers: ['Romance'], characters: [], turns: [], world: { id: 'w2', name: 'Saint-Avril', type: 'town', details: {} } },
  { id: 'a3', scenario: 'Last Light on Halcyon', triggers: ['Sci-fi'], characters: [], turns: [] },
] as unknown as Adventure[]

const meta = {
  title: 'Landing/BeginZone',
  component: BeginZone,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The "begin anew" zone — genre chips plus an image-forward grid of adventure templates, with no-match and first-adventure CTA panels.' } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  argTypes: {
    onFilterChange: { control: false }, onBegin: { control: false }, onEdit: { control: false },
    onDelete: { control: false }, onViewAll: { control: false }, onCreate: { control: false },
  },
  args: {
    scenes: TEMPLATES.map(toScene),
    totalCount: TEMPLATES.length,
    genres: ['Mystery', 'Romance', 'Sci-fi'],
    filter: 'All',
    onFilterChange: () => {},
    onBegin: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onViewAll: () => {},
    onCreate: () => {},
  },
} satisfies Meta<typeof BeginZone>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoGenreMatches: Story = {
  args: { scenes: [], filter: 'Western' },
}

export const FirstAdventure: Story = {
  args: { scenes: [], totalCount: 0, genres: [] },
}
