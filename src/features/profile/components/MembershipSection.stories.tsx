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
          'Membership tier cards from `GET /user/me` — the current plan plus reference-only previews (Plus/Pro) and the non-expiring PAYG credit card. Falls back to a simple legacy credits card when the profile has no `membership.profile_cards` block.',
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

/** Legacy account without the membership block — the simple credits card. */
export const LegacyCredits: Story = {
  args: { profile: { ...baseProfile, membership: undefined } },
}
