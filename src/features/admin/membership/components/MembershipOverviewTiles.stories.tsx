import type { Meta, StoryObj } from '@storybook/react-vite'
import { MembershipOverviewTiles } from './MembershipOverviewTiles'
import { overview } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/MembershipOverviewTiles',
    component: MembershipOverviewTiles,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Glanceable KPI row for the Membership & plans console: accounts, activity today, calendar-month credit usage, and PAYG wallet balances. Read-only; the Usage tab carries the per-plan breakdown.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[960px] max-w-full"><Story /></div>],
    argTypes: { overview: { control: false } },
    args: { overview, loading: false },
} satisfies Meta<typeof MembershipOverviewTiles>

export default meta
type Story = StoryObj<typeof meta>

/** A populated snapshot. */
export const Populated: Story = {}

/** Placeholder tiles before the first snapshot arrives. */
export const Loading: Story = { args: { overview: null, loading: true } }
