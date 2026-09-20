import type { Meta, StoryObj } from '@storybook/react-vite'
import { MembersList } from './MembersList'
import { members } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/MembersList',
    component: MembersList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Member rows for the Membership & plans console: identity, plan badge (neutral free / arcane billing-owned / ember custom), today\'s included usage against the plan allowance, month ledger credits, PAYG balance, and the Change plan action.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
    argTypes: { members: { control: false } },
    args: {
        members,
        loading: false,
        hasMore: false,
        loadingMore: false,
        onLoadMore: () => undefined,
        onAssign: () => undefined,
        busy: false,
    },
} satisfies Meta<typeof MembersList>

export default meta
type Story = StoryObj<typeof meta>

/** A paid member near the daily allowance, a root on a custom plan, and a brand-new account. */
export const Populated: Story = {}

/** More pages available. */
export const WithLoadMore: Story = { args: { hasMore: true } }

/** No accounts match the current filter. */
export const Empty: Story = { args: { members: [] } }
