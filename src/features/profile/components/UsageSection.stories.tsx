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
          'Per-operation usage meters from `GET /user/me` membership limits — daily allowance, used-today, and in-flight caps for chat, card generation, images, themes, and TTS. Renders nothing when the profile carries no membership block (legacy accounts).',
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
        credits: { ...membership.credits, used: 18, remaining: 2 },
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
