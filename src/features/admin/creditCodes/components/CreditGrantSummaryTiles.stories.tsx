import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreditGrantSummaryTiles } from './CreditGrantSummaryTiles'

const meta = {
    title: 'Admin/CreditCodes/CreditGrantSummaryTiles',
    component: CreditGrantSummaryTiles,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'KPI tiles for the active inventory — count + total credits per lifecycle state. Each tile doubles as a filter; the selected one is highlighted and clicking it again clears back to "All".',
            },
        },
    },
    decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
    args: {
        counts: {
            active: 12,
            active_credits: 3000,
            claimed: 7,
            claimed_credits: 1750,
            expired: 3,
            expired_credits: 600,
            disabled: 1,
            disabled_credits: 100,
            total: 23,
            total_credits: 5450,
        },
        activeStatus: 'active',
        onSelect: () => undefined,
    },
} satisfies Meta<typeof CreditGrantSummaryTiles>

export default meta
type Story = StoryObj<typeof meta>

/** Populated counts with the Active tile selected. */
export const Default: Story = {}

/** Loading — counts not yet resolved (dashes). */
export const Loading: Story = { args: { counts: undefined } }

/** No filter selected (every tile inert). */
export const NoneSelected: Story = { args: { activeStatus: 'all' } }
