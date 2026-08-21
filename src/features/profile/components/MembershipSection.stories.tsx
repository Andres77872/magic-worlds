import type { Meta, StoryObj } from '@storybook/react-vite'
import { baseProfile } from './ProfileView.stories'
import { MembershipSection } from './MembershipSection'

const meta = {
  title: 'Features/Profile/MembershipSection',
  component: MembershipSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Membership tier cards from the stored `GET /user/me` payload — the current plan, reference-only previews, and PAYG balances.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[920px] max-w-full"><Story /></div>],
  argTypes: { profile: { control: false } },
  args: { profile: baseProfile },
} satisfies Meta<typeof MembershipSection>

export default meta
type Story = StoryObj<typeof meta>

/** Free plan current, Plus/Pro as reference previews, PAYG balance card. */
export const Default: Story = {}

/**
 * Stripe billing enabled server-side — the "Plans & credits" entry appears. When
 * billing is off (the default) the purchase entry is hidden so the UI never
 * advertises a checkout that can't run.
 */
export const BillingEnabled: Story = {
  args: { billingEnabled: true },
}
