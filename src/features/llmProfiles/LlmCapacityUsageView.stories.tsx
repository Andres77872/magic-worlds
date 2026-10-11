import type { Meta, StoryObj } from '@storybook/react-vite'
import { LlmCapacityUsageView } from './LlmCapacityUsageView'
import { personalCapacityUsage } from './llmCapacityFixtures'

const meta = {
    title: 'Profile/Models/Request usage', component: LlmCapacityUsageView, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Personal request counts by payer, separate from app credits and provider charges. Neutral tokens keep this a read-only report.' } } },
    args: { usage: personalCapacityUsage },
} satisfies Meta<typeof LlmCapacityUsageView>
export default meta
type Story = StoryObj<typeof meta>
export const ByPayer: Story = {}
export const Loading: Story = { args: { usage: null, loading: true } }
export const Unavailable: Story = { args: { usage: null, error: 'Request usage could not be loaded. Refresh to try again.' } }
