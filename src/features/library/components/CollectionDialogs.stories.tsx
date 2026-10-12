import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Collection } from '@/shared/types'
import { Button } from '@/ui/primitives'
import { CollectionFormDialog } from './CollectionFormDialog'
import { CollectionPickerDialog } from './CollectionPickerDialog'

const WORKSPACE_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'

function collection(id: string, name: string, cardCount: number, position: number): Collection {
    return {
        id,
        workspace_id: WORKSPACE_ID,
        name,
        description: null,
        position,
        card_count: cardCount,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
    }
}

const collections = [
    collection('2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e', 'Cast of the northern arc', 14, 0),
    collection('3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f', 'Ashfall locations', 6, 1),
    collection('4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f8a', 'Relics', 0, 2),
]

function FormDemo({ editing }: { editing?: boolean }) {
    const [open, setOpen] = useState(true)
    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>{editing ? 'Edit collection' : 'New collection'}</Button>
            <CollectionFormDialog
                open={open}
                collection={editing ? { ...collections[0], description: 'Everyone who crosses the frozen pass.' } : null}
                onClose={() => setOpen(false)}
                onSubmit={async () => null}
            />
        </>
    )
}

function PickerDemo({ empty }: { empty?: boolean }) {
    const [open, setOpen] = useState(true)
    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>Add to collection</Button>
            <CollectionPickerDialog
                open={open}
                collections={empty ? [] : collections}
                cardCount={3}
                onClose={() => setOpen(false)}
                onCreateCollection={() => {}}
                onConfirm={async () => {
                    setOpen(false)
                    return null
                }}
            />
        </>
    )
}

const meta = {
    title: 'Library/CollectionDialogs',
    component: CollectionFormDialog,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Collection dialogs of the Library. The form creates or edits a flat collection (name up to 160 characters, optional description that search also matches); edits send the collection’s version and a conflict reloads it. The picker adds the selected cards to one or more collections; a card always stays in the library.',
            },
        },
    },
    args: {
        open: true,
        onClose: () => {},
        onSubmit: async () => null,
    },
} satisfies Meta<typeof CollectionFormDialog>

export default meta
type Story = StoryObj<typeof meta>

export const NewCollection: Story = {
    render: () => <FormDemo />,
}

export const EditCollection: Story = {
    render: () => <FormDemo editing />,
}

export const AddToCollection: Story = {
    render: () => <PickerDemo />,
}

export const NoCollectionsYet: Story = {
    render: () => <PickerDemo empty />,
}
