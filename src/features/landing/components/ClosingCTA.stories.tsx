import type { Meta, StoryObj } from '@storybook/react-vite'
import { ClosingCTA } from './ClosingCTA'

const meta = {
  title: 'Landing/ClosingCTA',
  component: ClosingCTA,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'A centered, candlelit send-off — one soft ember→arcane glow, the brand flame, a big invitation, and a single action. Footer links the open-source repo.' } },
  },
  argTypes: { actionLabel: { control: 'text' }, onAction: { control: false } },
  args: { onAction: () => {} },
} satisfies Meta<typeof ClosingCTA>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
