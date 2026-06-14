import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Lorebook } from '@/shared'
import { LorebookRail } from './LorebookRail'

function lorebook(id: string, name: string, description: string, tags: string[]): Lorebook {
  return {
    id,
    name,
    description,
    tags,
    enabled: true,
    settings: {},
    entries: [
      { id: `${id}-e1`, enabled: true, isSecret: false, keys: ['king', 'crown'] },
      { id: `${id}-e2`, enabled: true, isSecret: true, keys: ['betrayal'] },
    ],
    attachments: [{ id: `${id}-a1` }],
  } as unknown as Lorebook
}

const LOREBOOKS = [
  lorebook('l1', 'The Ember Codex', 'Histories of the coast and its drowned kings.', ['history', 'coast']),
  lorebook('l2', 'Station Protocols', 'Operating lore for Halcyon Station.', ['sci-fi']),
  lorebook('l3', 'Folk of the Wood', 'Names and bargains of the forest folk.', ['folk', 'fey']),
]

const meta = {
  title: 'Landing/LorebookRail',
  component: LorebookRail,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: "The dashboard's lore & memory shelf — reuses the gallery LorebookCard in a horizontal rail with its own delete confirmation." } },
  },
  decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
  args: {
    lorebooks: LOREBOOKS,
    total: 3,
    onOpen: () => {},
    onDelete: () => {},
    onViewAll: () => {},
  },
} satisfies Meta<typeof LorebookRail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
