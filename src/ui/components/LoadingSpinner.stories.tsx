import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadingSpinner } from './LoadingSpinner'

const meta = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Candlelit loading indicator — an ember spinner with an optional narrative message.' } },
  },
  argTypes: {
    message: { control: 'text' },
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
  },
  args: { message: 'Summoning the scene…', size: 'medium' },
} satisfies Meta<typeof LoadingSpinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Large: Story = { args: { size: 'large', message: 'Conjuring your world…' } }
export const Small: Story = { args: { size: 'small', message: '' } }
