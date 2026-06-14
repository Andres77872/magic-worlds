import type { Meta, StoryObj } from '@storybook/react-vite'
import { Globe } from 'lucide-react'
import type { World } from '@/shared'
import { LibraryRail } from './LibraryRail'
import { worldCardProps } from './libraryCards'

const WORLDS = [
  { id: 'w1', name: 'The Ember Coast', type: 'Region', place_type: 'Coast', triggers: ['storms'], details: {} },
  { id: 'w2', name: "Vael's End", type: 'Kingdom', place_type: 'Capital', triggers: ['exile'], details: {} },
  { id: 'w3', name: 'Halcyon Station', type: 'Station', place_type: 'Orbital', triggers: ['isolation'], details: {} },
  { id: 'w4', name: 'The Hollow Wood', type: 'Forest', place_type: 'Wild', triggers: ['folk'], details: {} },
] as unknown as World[]

const meta = {
  title: 'Landing/LibraryRail',
  component: LibraryRail<World>,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Generic portrait-card rail for one library collection (worlds, items) — a quiet reference shelf near the bottom of the dashboard. Owns its own delete confirmation.' } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
} satisfies Meta<typeof LibraryRail<World>>

export default meta
type Story = StoryObj<typeof meta>

export const Worlds: Story = {
  args: {
    title: "Worlds you've built",
    icon: Globe,
    tone: 'ember',
    items: WORLDS,
    total: 9,
    cardType: 'world',
    deleteTitle: 'Delete world',
    toCard: worldCardProps,
    onEdit: () => {},
    onDelete: () => {},
    onViewAll: () => {},
  },
}
