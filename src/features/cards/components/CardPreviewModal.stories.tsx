import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Button } from '@/ui/primitives'
import type { CardPreview } from '../cardPreview'
import { CardPreviewModal } from './CardPreviewModal'

const SAMPLE: CardPreview = {
    id: 'w1',
    type: 'world',
    mediaType: 'world',
    title: 'The Sunken Library',
    badge: 'Ruin',
    description: 'A drowned archive where every book still whispers the secrets it kept above water.',
    triggers: ['library', 'water', 'forbidden knowledge'],
    createdAt: '2026-06-01T09:00:00',
    updatedAt: '2026-06-10T12:00:00',
}

const meta = {
    title: 'Components/Cards/CardPreviewModal',
    component: CardPreviewModal,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Full card preview shown before importing a public/community card. The import footer (attribution, Import / Import-a-copy, Open existing) only renders when `onImport` is provided — otherwise it is a read-only preview.',
            },
        },
    },
    args: {
        target: { type: 'world', id: 'w1' },
        card: SAMPLE,
        loading: false,
        error: null,
        onClose: () => {},
    },
} satisfies Meta<typeof CardPreviewModal>

export default meta
type Story = StoryObj<typeof meta>

function PreviewDemo(args: ComponentProps<typeof CardPreviewModal>) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
                Open preview
            </Button>
            <CardPreviewModal {...args} target={open ? args.target : null} onClose={() => setOpen(false)} />
        </>
    )
}

export const Default: Story = { render: (args) => <PreviewDemo {...args} /> }

export const WithImport: Story = {
    args: { originalCreatorName: 'loremaster', onImport: () => {} },
    render: (args) => <PreviewDemo {...args} />,
}

export const AlreadyImported: Story = {
    args: { originalCreatorName: 'loremaster', alreadyImported: true, onImport: () => {}, onOpenExisting: () => {} },
    render: (args) => <PreviewDemo {...args} />,
}

export const Importing: Story = {
    args: { onImport: () => {}, importing: true },
    render: (args) => <PreviewDemo {...args} />,
}

export const Loading: Story = {
    args: { card: null, loading: true },
    render: (args) => <PreviewDemo {...args} />,
}

export const Unavailable: Story = {
    args: { card: null, error: 'This card could not be loaded.' },
    render: (args) => <PreviewDemo {...args} />,
}
