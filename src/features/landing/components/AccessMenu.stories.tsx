import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccessMenu } from './AccessMenu'

const meta = {
  title: 'Landing/AccessMenu',
  component: AccessMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The in-page way to start creating. `full` is a row of large cards (guest / empty view); `compact` is a slim strip of buttons for returning users.' } },
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['full', 'compact'] },
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    onAction: { control: false },
  },
  args: { variant: 'full', onAction: () => {} },
} satisfies Meta<typeof AccessMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {}
export const Compact: Story = {
  args: { variant: 'compact' },
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="w-[860px] max-w-full"><Story /></div>],
}
