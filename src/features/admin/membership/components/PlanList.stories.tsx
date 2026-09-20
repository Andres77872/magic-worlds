import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlanList } from './PlanList'
import { plans } from '../membership.fixtures'

const meta = {
    title: 'Admin/Membership/PlanList',
    component: PlanList,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root-only plan catalog. Ember marks locally-owned plans (the free fallback and custom plans), arcane marks billing-synced paid defaults that mirror the Stripe catalog, and neutral marks an inactive plan. The dashed tile at the end opens the create dialog.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[1100px] max-w-full"><Story /></div>],
    argTypes: { plans: { control: false } },
    args: {
        plans,
        loading: false,
        onCreate: () => undefined,
        onEdit: () => undefined,
        onViewMembers: () => undefined,
    },
} satisfies Meta<typeof PlanList>

export default meta
type Story = StoryObj<typeof meta>

/** The three schema defaults, one active custom plan, and one retired custom plan. */
export const Catalog: Story = {}

/** Only the schema defaults, before any custom plan exists. */
export const DefaultsOnly: Story = { args: { plans: plans.filter((plan) => plan.is_default) } }

/** Still loading the catalog. */
export const Loading: Story = { args: { plans: [], loading: true } }
