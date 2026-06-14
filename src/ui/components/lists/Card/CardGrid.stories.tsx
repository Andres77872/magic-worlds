import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character } from '@/shared/types'
import { Tag } from '@/ui/primitives'
import { Card } from './Card'
import { CardGrid } from './CardGrid'
import { GalleryCard } from './GalleryCard'
import { GalleryCardSkeleton } from './GalleryCardSkeleton'
import { characters } from '../fixtures'

const renderCharacter = (c: Character) => (
  <Card key={c.id} title={c.name} subtitle={<Tag>{c.race}</Tag>}>
    <div className="font-narrative text-sm italic text-parchment-400">
      {Object.entries(c.stats).map(([k, v]) => `${k}: ${v}`).join(' • ')}
    </div>
  </Card>
)

const railCharacters = [...characters, ...characters, ...characters].map((character, index) => ({
  ...character,
  id: `${character.id}-rail-${index}`,
}))

const renderRailCard = (c: Character) => (
  <GalleryCard
    title={c.name}
    badge={c.race}
    tags={c.class ? [c.class] : []}
    size="compact"
  />
)

const meta = {
  title: 'Components/Lists/CardGrid',
  component: CardGrid<Character>,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Responsive, generic grid with optional search, loading, empty state, and infinite scroll. Pass `items` plus a `renderCard` callback.' } },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>],
  argTypes: {
    loading: { control: 'boolean' },
    onSearch: { control: false },
    items: { control: false },
    renderCard: { control: false },
  },
  args: { items: characters, renderCard: renderCharacter, loading: false },
} satisfies Meta<typeof CardGrid<Character>>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSearch: Story = {
  args: { onSearch: () => {}, searchPlaceholder: 'Search characters…' },
}

export const Loading: Story = { args: { loading: true } }

export const LoadingSkeletons: Story = {
  args: { loading: true, density: 'compact', renderSkeleton: () => <GalleryCardSkeleton /> },
  parameters: {
    docs: {
      description: {
        story:
          'Image-forward galleries pass `renderSkeleton` so the initial load reserves the cards’ 3:4 box (a matched skeleton grid) instead of flashing a centered spinner, and infinite-scroll appends the same skeleton.',
      },
    },
  },
}

export const Empty: Story = {
  args: {
    items: [],
    emptyStateTitle: 'No characters yet',
    emptyStateDescription: 'Conjure your first companion to see them here.',
  },
}

export const Rail: Story = {
  args: {
    items: railCharacters,
    layout: 'rail',
    railWidth: 'compact',
    fadeEdges: true,
    renderCard: renderRailCard,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dashboard shelf mode: 200px portrait cards, scroll-snap, a right-edge fade hinting at more content, and the rail entrance animation (cards rise + fade in as they intersect the viewport).',
      },
    },
  },
}

export const RailWithoutOverflow: Story = {
  args: {
    items: characters.slice(0, 2),
    layout: 'rail',
    railWidth: 'compact',
    fadeEdges: true,
    renderCard: renderRailCard,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Short shelf: fadeEdges is enabled, but no edge fade is applied because every card fits in the visible rail.',
      },
    },
  },
}
