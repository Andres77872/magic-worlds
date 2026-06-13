import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccessMenu } from './AccessMenu'

const meta = {
  title: 'Landing/AccessMenu',
  component: AccessMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The in-page way to start creating on the guest / empty-account front door — a row of large IconTile cards. Returning users get the CreateBand workbench instead.' } },
  },
  argTypes: {
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    onAction: { control: false },
  },
  args: { onAction: () => {} },
} satisfies Meta<typeof AccessMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
