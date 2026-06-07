import type { Meta, StoryObj } from '@storybook/react-vite'
import { HowItWorksSection } from './HowItWorksSection'

const meta = {
  title: 'Landing/HowItWorksSection',
  component: HowItWorksSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'A calm, three-step explainer of the roleplay loop (choose → set the scene → play it out) on a full-bleed void band with arcane-tinted icon tiles.' } },
  },
} satisfies Meta<typeof HowItWorksSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
