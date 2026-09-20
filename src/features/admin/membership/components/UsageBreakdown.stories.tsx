import type { Meta, StoryObj } from '@storybook/react-vite'
import { UsageBreakdown } from './UsageBreakdown'
import { overview } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/UsageBreakdown',
    component: UsageBreakdown,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Usage tab of the Membership & plans console: per-plan activity and credits (today + calendar month, ember bars) and the month\'s per-operation totals (arcane bars). Bars are proportional to the largest value in their column.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
    argTypes: { overview: { control: false } },
    args: { overview },
} satisfies Meta<typeof UsageBreakdown>

export default meta
type Story = StoryObj<typeof meta>

/** A populated month. */
export const Populated: Story = {}

/** Nothing loaded yet. */
export const Empty: Story = { args: { overview: null } }
