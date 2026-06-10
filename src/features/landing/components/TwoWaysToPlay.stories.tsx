import type { Meta, StoryObj } from '@storybook/react-vite'
import { TwoWaysToPlay } from './TwoWaysToPlay'

const meta = {
  title: 'Landing/TwoWaysToPlay',
  component: TwoWaysToPlay,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Spells out the two play modes side by side — Adventure (Game Master–led role-play, ember) vs Chat (1:1 conversation, arcane) — teaching the same color language the ModeBadge uses.' } },
  },
} satisfies Meta<typeof TwoWaysToPlay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
