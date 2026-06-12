import type { Meta, StoryObj } from '@storybook/react-vite'
import { LandingLoading } from './LandingLoading'

const meta = {
  title: 'Landing/LandingLoading',
  component: LandingLoading,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The full-screen loading state shown while the dashboard data is summoned.' } },
  },
} satisfies Meta<typeof LandingLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
