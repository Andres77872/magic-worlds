import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShowcaseWorlds } from './ShowcaseWorlds'

const meta = {
  title: 'Landing/ShowcaseWorlds',
  component: ShowcaseWorlds,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'A curated row of example worlds so a first-time or empty landing feels alive. Selecting one routes through the auth gate.' } },
  },
  argTypes: { onTry: { control: false }, sectionRef: { control: false } },
  args: { onTry: () => {} },
} satisfies Meta<typeof ShowcaseWorlds>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
