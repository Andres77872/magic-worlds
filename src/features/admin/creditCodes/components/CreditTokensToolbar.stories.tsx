import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditTokensToolbar } from './CreditTokensToolbar'

const meta = {
    title: 'Admin/CreditCodes/CreditTokensToolbar',
    component: CreditTokensToolbar,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The single control surface for the Credit Tokens console: Codes / Email type switch, debounced search, status filter chips (default Active), sort selector, and Create / Export CSV actions. All filtering resolves server-side.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[900px] max-w-full"><Story /></div>],
    args: {
        activeType: 'code',
        onTypeChange: () => undefined,
        status: 'active',
        onStatusChange: () => undefined,
        search: '',
        onSearchChange: () => undefined,
        searching: false,
        sort: 'recent',
        onSortChange: () => undefined,
        total: 24,
        onCreate: () => undefined,
        createActive: false,
        onExport: () => undefined,
        exporting: false,
        exportDisabled: false,
    },
} satisfies Meta<typeof CreditTokensToolbar>

export default meta
type Story = StoryObj<typeof meta>

/** Default: codes inventory, Active filter, newest-first. */
export const Default: Story = {}

/** Searching the email inventory with a query in flight. */
export const SearchingEmail: Story = {
    args: { activeType: 'email', status: 'all', search: 'mira@', searching: true, sort: 'expiry' },
}

/** Create panel open (button reflects the expanded state). */
export const CreateOpen: Story = { args: { createActive: true } }
