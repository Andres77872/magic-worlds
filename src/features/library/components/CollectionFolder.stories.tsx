import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pencil, Trash2 } from 'lucide-react'
import { Icon } from '@/ui/primitives'
import { CollectionFolder } from './CollectionFolder'

const northernArc = {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Cast of the northern arc',
    description: 'Everyone who crosses the frozen pass in book two.',
    card_count: 14,
}

const options = [
    { type: 'custom' as const, icon: <Icon icon={Pencil} size={15} />, label: 'Edit collection', onClick: () => {} },
    { type: 'custom' as const, icon: <Icon icon={Trash2} size={15} />, label: 'Delete collection', onClick: () => {}, danger: true },
]

const meta = {
    title: 'Library/CollectionFolder',
    component: CollectionFolder,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'A Workspace R1 collection as a compact folder entry in the Library: folder icon, the word Collection, its name and card count. Ember marks it as the person’s own organization. Never a portrait card; the main button opens it and the menu holds edit/delete (omitted in a read-only workspace).',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[280px]">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        view: { control: 'inline-radio', options: ['card', 'row'] },
        onOpen: { action: 'opened' },
        options: { control: false },
    },
    args: {
        collection: northernArc,
        view: 'card',
        onOpen: () => {},
        options,
    },
} satisfies Meta<typeof CollectionFolder>

export default meta
type Story = StoryObj<typeof meta>

export const Tile: Story = {}

/** List view shows the description under the count. */
export const Row: Story = {
    args: { view: 'row' },
    decorators: [
        (Story) => (
            <div className="w-[520px]">
                <Story />
            </div>
        ),
    ],
}

/** Archived workspace: no edit or delete menu. */
export const ReadOnly: Story = {
    args: { options: [] },
}

export const Empty: Story = {
    args: { collection: { ...northernArc, name: 'Unsorted sketches', description: null, card_count: 0 } },
}
