import type { Meta, StoryObj } from '@storybook/react-vite'
import { LibraryNewMenu } from './LibraryNewMenu'

const meta = {
    title: 'Library/LibraryNewMenu',
    component: LibraryNewMenu,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The Library header’s New menu: New collection (library root only), each card type’s existing creator, and Import card, filtered by the feature flags. The trigger’s title names where new cards are saved. A type filter is never a destination.',
            },
        },
    },
    argTypes: {
        inCollection: { control: 'boolean' },
        adventuresEnabled: { control: 'boolean' },
        importEnabled: { control: 'boolean' },
        onSelect: { action: 'selected' },
    },
    args: {
        inCollection: false,
        adventuresEnabled: true,
        importEnabled: true,
        destinationLabel: 'Saves to Main library',
        onSelect: () => {},
    },
} satisfies Meta<typeof LibraryNewMenu>

export default meta
type Story = StoryObj<typeof meta>

export const AtLibraryRoot: Story = {}

/** Inside a folder: no nested collections; new cards join this collection. */
export const InCollection: Story = {
    args: { inCollection: true, destinationLabel: 'Saves to Main library / Cast of the northern arc' },
}

export const WithoutOptionalFeatures: Story = {
    args: { adventuresEnabled: false, importEnabled: false },
}
