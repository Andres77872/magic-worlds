import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Character } from '@/shared/types'
import { Tag } from '@/ui/primitives'
import { Card } from './Card'
import { CardGrid } from './CardGrid'
import { characters } from '../fixtures'

const renderCharacter = (c: Character) => (
  <Card key={c.id} title={c.name} subtitle={<Tag>{c.race}</Tag>}>
    <div className="font-narrative text-sm italic text-parchment-400">
      {Object.entries(c.stats).map(([k, v]) => `${k}: ${v}`).join(' • ')}
    </div>
  </Card>
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

export const Empty: Story = {
  args: {
    items: [],
    emptyStateTitle: 'No characters yet',
    emptyStateDescription: 'Conjure your first companion to see them here.',
  },
}
