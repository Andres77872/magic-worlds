import type { Meta, StoryObj } from '@storybook/react-vite'
import { BulkSelectionBar } from './BulkSelectionBar'

const meta = {
    title: 'Library/BulkSelectionBar',
    component: BulkSelectionBar,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The Library’s bulk organization toolbar. Selection covers the cards loaded on this page; Add to collection and Remove from this collection never delete a card, and Copy to workspace is disabled past the 20-card copy limit with the reason shown. In an archived workspace only copying stays available.',
            },
        },
    },
    argTypes: {
        inCollection: { control: 'boolean' },
        readOnly: { control: 'boolean' },
        busy: { control: 'boolean' },
        onSelectPage: { action: 'select page' },
        onClear: { action: 'clear' },
        onDone: { action: 'done' },
        onAddToCollection: { action: 'add to collection' },
        onRemoveFromCollection: { action: 'remove from collection' },
        onCopyToWorkspace: { action: 'copy to workspace' },
    },
    args: {
        count: 3,
        pageCount: 24,
        inCollection: false,
        readOnly: false,
        busy: false,
        onSelectPage: () => {},
        onClear: () => {},
        onDone: () => {},
        onAddToCollection: () => {},
        onRemoveFromCollection: () => {},
        onCopyToWorkspace: () => {},
    },
} satisfies Meta<typeof BulkSelectionBar>

export default meta
type Story = StoryObj<typeof meta>

export const AtLibraryRoot: Story = {}

export const NothingSelected: Story = {
    args: { count: 0 },
}

/** Inside a folder: Remove from this collection appears. */
export const InCollection: Story = {
    args: { inCollection: true, count: 5 },
}

/** Over the copy limit: copying is disabled with the reason. */
export const OverCopyLimit: Story = {
    args: { count: 24 },
}

/** Archived workspace: organization is read-only, copying out stays available. */
export const ReadOnly: Story = {
    args: { readOnly: true, inCollection: true },
}
