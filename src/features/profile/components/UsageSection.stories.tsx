import type { Meta, StoryObj } from '@storybook/react-vite'
import { membership, baseProfile } from './ProfileView.stories'
import { UsageSection } from './UsageSection'

const meta = {
  title: 'Features/Profile/UsageSection',
  component: UsageSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Combined usage monitor from `GET /user/me`: today shows daily allowance and operation limits, while month-to-date shows accumulated credits and operation counts without implying a monthly cap.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  argTypes: { profile: { control: false } },
  args: { profile: baseProfile },
} satisfies Meta<typeof UsageSection>

export default meta
type Story = StoryObj<typeof meta>

/** A typical day: a few credits spent across operations. */
export const Default: Story = {}

/** Heavy usage — meters approaching their daily limits. */
export const NearLimits: Story = {
  args: {
    profile: {
      ...baseProfile,
      membership: {
        ...membership,
        credits: { ...membership.credits, used: 48, remaining: 2 },
        limits: Object.fromEntries(
          Object.entries(membership.limits).map(([operation, limit]) => [
            operation,
            { ...limit, used_today: Math.max(limit.daily_limit - 1, 0), in_flight: 1 },
          ]),
        ),
      },
    },
  },
}

/** Month-to-date usage with PAYG credits mixed into the accumulated totals. */
export const PaygMonth: Story = {
  args: {
    profile: {
      ...baseProfile,
      membership: {
        ...membership,
        monthly_usage: {
          ...membership.monthly_usage!,
          credits_used: 148,
          included_credits_used: 93,
          payg_credits_used: 55,
          operations: {
            chat_interaction: { used: 80, credits_used: 80, included_credits_used: 50, payg_credits_used: 30 },
            ai_card_generation: { used: 18, credits_used: 18, included_credits_used: 14, payg_credits_used: 4 },
            image_generation: { used: 31, credits_used: 31, included_credits_used: 18, payg_credits_used: 13 },
            theme_song_generation: { used: 7, credits_used: 7, included_credits_used: 4, payg_credits_used: 3 },
            tts_generation: { used: 12, credits_used: 12, included_credits_used: 7, payg_credits_used: 5 },
          },
        },
      },
    },
  },
}

/** Older API response: daily monitor only, no month-to-date panel. */
export const NoMonthlyData: Story = {
  args: {
    profile: {
      ...baseProfile,
      membership: {
        ...membership,
        monthly_usage: undefined,
      },
    },
  },
}
